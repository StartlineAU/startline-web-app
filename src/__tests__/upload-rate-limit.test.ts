import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// The upload surface is three routes, not one. In production a single file is
// presign -> S3 direct -> complete, and in local/Docker mode it is presign ->
// /api/upload. Every one of them was unlimited, so these assert the wiring: the
// right budget on the right route, checked before any work is done.

const mocks = vi.hoisted(() => {
  class PutObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  class GetObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  class DeleteObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  return {
    getOrganiserSession: vi.fn(),
    getAdminSession: vi.fn(),
    getUserSession: vi.fn(),
    rateLimit: vi.fn(),
    createPresignedPost: vi.fn(),
    send: vi.fn(),
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
  };
});

vi.mock("@/lib/amplify-server", () => ({
  getOrganiserSession: mocks.getOrganiserSession,
  getAdminSession: mocks.getAdminSession,
  getUserSession: mocks.getUserSession,
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: mocks.createPresignedPost,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: mocks.PutObjectCommand,
  GetObjectCommand: mocks.GetObjectCommand,
  DeleteObjectCommand: mocks.DeleteObjectCommand,
}));

vi.mock("@/lib/s3", () => ({
  s3: { send: mocks.send },
  S3_BUCKET: "startline-staging-uploads",
  S3_PUBLIC_BASE_URL: "https://cdn.startlineau.com",
  UPLOADS_USE_S3: true,
}));

import { POST as upload } from "@/app/api/upload/route";
import { POST as presign } from "@/app/api/upload/presign/route";
import { POST as complete } from "@/app/api/upload/complete/route";

const SUB = "cog_sarah";

/** What rateLimit returns when the caller is over budget. */
const tooMany = () =>
  NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

const post = (url: string) => new Request(url, { method: "POST" }) as never;

// /api/upload reads a multipart body once past the limiter, so it needs a real
// one. Left empty on purpose: the route then 400s on the missing file, which is
// far enough for these tests and never reaches S3.
const postForm = (url: string) =>
  new Request(url, { method: "POST", body: new FormData() }) as never;

const call = {
  upload: () => upload(postForm("http://localhost/api/upload")),
  presign: () => presign(post("http://localhost/api/upload/presign")),
  complete: () => complete(post("http://localhost/api/upload/complete")),
};

const optionsFor = () => {
  const entry = mocks.rateLimit.mock.calls.at(-1);
  return entry?.[1] as { prefix: string; limit: number; windowSeconds: number; identifier: string };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrganiserSession.mockResolvedValue({ sub: SUB });
  mocks.getAdminSession.mockResolvedValue(null);
  mocks.getUserSession.mockResolvedValue(null);
  mocks.rateLimit.mockResolvedValue(null);
});

describe("upload rate limits", () => {
  const routes = [
    { name: "upload" as const, prefix: "upload", limit: 30 },
    { name: "presign" as const, prefix: "upload-presign", limit: 30 },
    { name: "complete" as const, prefix: "upload-complete", limit: 120 },
  ];

  for (const route of routes) {
    describe(`/api/upload${route.name === "upload" ? "" : "/" + route.name}`, () => {
      it(`limits ${route.limit} a minute, keyed on the caller rather than the IP`, async () => {
        await call[route.name]();

        expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
        expect(optionsFor()).toEqual({
          prefix: route.prefix,
          limit: route.limit,
          windowSeconds: 60,
          identifier: SUB,
        });
      });

      it("returns the limiter's 429 and does no work", async () => {
        mocks.rateLimit.mockResolvedValue(tooMany());

        const res = await call[route.name]();

        expect(res.status).toBe(429);
        expect(mocks.send).not.toHaveBeenCalled();
        expect(mocks.createPresignedPost).not.toHaveBeenCalled();
      });

      it("rejects an unauthenticated caller without spending a slot", async () => {
        mocks.getOrganiserSession.mockResolvedValue(null);

        const res = await call[route.name]();

        expect(res.status).toBe(401);
        expect(mocks.rateLimit).not.toHaveBeenCalled();
      });
    });
  }

  // Each route carries its own counter, so a proxy-mode upload (presign answers
  // "proxy", the client then posts to /api/upload) spends one slot in each
  // rather than two in a shared one.
  it("gives every route its own counter", async () => {
    await call.upload();
    await call.presign();
    await call.complete();

    const prefixes = mocks.rateLimit.mock.calls.map(([, opts]) => opts.prefix);
    expect(new Set(prefixes).size).toBe(3);
  });

  // The design invariant. By the time complete is called the file is already in
  // the bucket, so a 429 there strands an object nothing will verify or delete.
  it("keeps complete well above the signing rate so it cannot strand an upload", async () => {
    // Read back off the routes themselves, not off the table above, so this
    // still bites if someone lowers the limit in the route.
    await call.presign();
    const presignLimit = optionsFor().limit;
    await call.complete();
    const completeLimit = optionsFor().limit;

    expect(completeLimit).toBeGreaterThan(presignLimit);
  });
});
