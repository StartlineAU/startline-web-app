import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  // Declared in here because vi.mock factories are hoisted above the file body,
  // so a class defined below would not exist yet when the factory runs.
  class GetObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  class DeleteObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  class CopyObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  return {
    CopyObjectCommand,
    getOrganiserSession: vi.fn(),
    getAdminSession: vi.fn(),
    getUserSession: vi.fn(),
    createPresignedPost: vi.fn(),
    send: vi.fn(),
    useS3: true,
    GetObjectCommand,
    DeleteObjectCommand,
  };
});

vi.mock("@/lib/amplify-server", () => ({
  getOrganiserSession: mocks.getOrganiserSession,
  getAdminSession: mocks.getAdminSession,
  getUserSession: mocks.getUserSession,
}));

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: mocks.createPresignedPost,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  GetObjectCommand: mocks.GetObjectCommand,
  DeleteObjectCommand: mocks.DeleteObjectCommand,
  CopyObjectCommand: mocks.CopyObjectCommand,
}));

// These tests are not about rate limiting, but both routes now call the limiter,
// which talks to Postgres. Left unmocked it opens a real connection per test and
// only passes because rateLimit fails open, so on a machine where DATABASE_URL
// resolves it would write real rows and start returning 429 mid-suite. Coverage
// of the limits themselves lives in upload-rate-limit.test.ts.
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(null) }));

vi.mock("@/lib/s3", () => ({
  s3: { send: mocks.send },
  S3_BUCKET: "startline-staging-uploads",
  S3_PUBLIC_BASE_URL: "https://cdn.startlineau.com",
  get UPLOADS_USE_S3() {
    return mocks.useS3;
  },
}));

import { POST as presign } from "@/app/api/upload/presign/route";
import { POST as complete } from "@/app/api/upload/complete/route";
import { UPLOAD_LIMITS } from "@/lib/upload-limits";

const SUB = "cog_sarah";
const MB = 1024 * 1024;

const post = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // The routes only ever call req.json(), so a plain Request stands in for
    // the NextRequest they are typed against.
  }) as unknown as Parameters<typeof presign>[0];

const presignReq = (body: unknown) => presign(post("http://localhost/api/upload/presign", body));
const completeReq = (body: unknown) => complete(post("http://localhost/api/upload/complete", body));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.useS3 = true;
  mocks.getOrganiserSession.mockResolvedValue({ sub: SUB });
  mocks.getAdminSession.mockResolvedValue(null);
  mocks.getUserSession.mockResolvedValue(null);
  mocks.createPresignedPost.mockResolvedValue({
    url: "https://startline-staging-uploads.s3.ap-southeast-2.amazonaws.com",
    fields: { key: "signed", policy: "p", "x-amz-signature": "sig" },
  });
});

describe("POST /api/upload/presign", () => {
  it("refuses a caller with no session", async () => {
    mocks.getOrganiserSession.mockResolvedValue(null);

    const res = await presignReq({ type: "photo", contentType: "image/jpeg", size: MB });

    expect(res.status).toBe(401);
    expect(mocks.createPresignedPost).not.toHaveBeenCalled();
  });

  it("tells the client to proxy when no bucket is configured", async () => {
    mocks.useS3 = false;

    const res = await presignReq({ type: "photo", contentType: "image/jpeg", size: MB });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: "proxy" });
  });

  it("rejects an upload type outside the allowlist", async () => {
    const res = await presignReq({ type: "archive", contentType: "image/jpeg", size: MB });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid upload type.");
  });

  it("rejects a MIME type that is not allowed for the upload type", async () => {
    const res = await presignReq({ type: "photo", contentType: "application/pdf", size: MB });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("File type not allowed for this upload.");
  });

  it("rejects a file over the cap before signing anything", async () => {
    const res = await presignReq({
      type: "photo",
      contentType: "image/jpeg",
      size: UPLOAD_LIMITS.photo.bytes + 1,
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Image must be 10 MB or smaller.");
    expect(mocks.createPresignedPost).not.toHaveBeenCalled();
  });

  // The 8 MB case is the reported bug: it is under our 10 MB cap but over the
  // ~4.4 MB that survives Amplify's Lambda payload ceiling, so it has to be
  // signed for a direct upload rather than proxied.
  it("signs an 8 MB photo that the compute runtime would have rejected", async () => {
    const res = await presignReq({ type: "photo", contentType: "image/jpeg", size: 8 * MB });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("s3");
    // Signed into the unserved pending prefix, with no URL until it is checked.
    expect(body.key).toMatch(new RegExp(`^pending/${SUB}/photo/[0-9a-f-]+\\.jpg$`));
    expect(body.fileUrl).toBeUndefined();
  });

  it("does not let an athlete account upload organisation or event files", async () => {
    mocks.getOrganiserSession.mockResolvedValue(null);
    mocks.getUserSession.mockResolvedValue({ sub: "cog_jade" });

    for (const type of ["photo", "cover", "logo", "document"]) {
      const res = await presignReq({ type, contentType: type === "document" ? "application/pdf" : "image/jpeg", size: MB });
      expect(res.status, type).toBe(401);
    }
    expect(mocks.createPresignedPost).not.toHaveBeenCalled();
  });

  it("does not let a suspended organisation upload", async () => {
    mocks.getOrganiserSession.mockResolvedValue({ sub: SUB, status: "SUSPENDED" });

    const res = await presignReq({ type: "photo", contentType: "image/jpeg", size: MB });

    expect(res.status).toBe(401);
  });

  it("no longer offers a video upload", async () => {
    const res = await presignReq({ type: "video", contentType: "video/mp4", size: MB });
    expect(res.status).toBe(400);
  });

  it("pins the size and content type into the signature", async () => {
    await presignReq({ type: "photo", contentType: "image/png", size: MB });

    const [, args] = mocks.createPresignedPost.mock.calls[0];
    expect(args.Fields).toEqual({ "Content-Type": "image/png" });
    expect(args.Conditions).toEqual([
      ["content-length-range", 1, UPLOAD_LIMITS.photo.bytes],
      ["eq", "$Content-Type", "image/png"],
    ]);
    expect(args.Key).toMatch(/\.png$/);
  });

  it("keys the object under the caller's own sub", async () => {
    mocks.getOrganiserSession.mockResolvedValue(null);
    mocks.getUserSession.mockResolvedValue({ sub: "cog_jade" });

    const res = await presignReq({ type: "avatar", contentType: "image/webp", size: MB });

    expect((await res.json()).key).toMatch(/^pending\/cog_jade\/avatar\//);
  });
});

describe("POST /api/upload/complete", () => {
  const FILE = "0f8fad5b-d9cb-469f-a165-70867728950e.jpg";
  const KEY = `pending/${SUB}/photo/${FILE}`;
  const SERVED = `uploads/${SUB}/photo/${FILE}`;
  const bodyOf = (bytes: number[]) => ({
    Body: { transformToByteArray: async () => new Uint8Array(bytes) },
  });
  const JPEG = [0xff, 0xd8, 0xff, 0xe0];

  it("publishes a checked object to the served prefix and returns its CDN url", async () => {
    mocks.send.mockResolvedValueOnce(bodyOf(JPEG)).mockResolvedValue({});

    const res = await completeReq({ key: KEY, type: "photo", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect((await res.json()).fileUrl).toBe(`https://cdn.startlineau.com/${SERVED}`);
    const copy = mocks.send.mock.calls[1][0];
    expect(copy).toBeInstanceOf(mocks.CopyObjectCommand);
    expect(copy.input).toMatchObject({ Key: SERVED, CopySource: `startline-staging-uploads/${KEY}`, ContentType: "image/jpeg", MetadataDirective: "REPLACE" });
    const cleanup = mocks.send.mock.calls[2][0];
    expect(cleanup).toBeInstanceOf(mocks.DeleteObjectCommand);
    expect(cleanup.input.Key).toBe(KEY);
  });

  it("serves a PDF as a download", async () => {
    const pdfKey = `pending/${SUB}/document/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`;
    mocks.send.mockResolvedValueOnce(bodyOf([0x25, 0x50, 0x44, 0x46, 0x2d])).mockResolvedValue({});

    const res = await completeReq({ key: pdfKey, type: "document", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(mocks.send.mock.calls[1][0].input.ContentDisposition).toBe("attachment");
  });

  it("never touches a served object", async () => {
    const res = await completeReq({ key: SERVED, type: "photo", contentType: "image/jpeg" });

    expect(res.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("reads only the leading bytes, not the whole object", async () => {
    mocks.send.mockResolvedValue(bodyOf(JPEG));

    await completeReq({ key: KEY, type: "photo", contentType: "image/jpeg" });

    const command = mocks.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(mocks.GetObjectCommand);
    expect(command.input.Range).toBe("bytes=0-15");
  });

  // Direct-to-S3 removes the inline magic-byte check, so this is the only
  // thing standing between a signed POST and arbitrary content in the bucket.
  it("deletes the object and refuses when the bytes do not match", async () => {
    mocks.send.mockResolvedValueOnce(bodyOf([0x3c, 0x21, 0x64, 0x6f])).mockResolvedValueOnce({});

    const res = await completeReq({ key: KEY, type: "photo", contentType: "image/jpeg" });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("File content does not match its type.");
    const deletion = mocks.send.mock.calls[1][0];
    expect(deletion).toBeInstanceOf(mocks.DeleteObjectCommand);
    expect(deletion.input.Key).toBe(KEY);
  });

  it("refuses a key belonging to another user", async () => {
    const res = await completeReq({
      key: `pending/cog_someone_else/photo/${FILE}`,
      type: "photo",
      contentType: "image/jpeg",
    });

    expect(res.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuses a key that climbs out of its own prefix", async () => {
    const res = await completeReq({
      key: `pending/${SUB}/photo/../../cog_other/photo/${FILE}`,
      type: "photo",
      contentType: "image/jpeg",
    });

    expect(res.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuses when the caller has no session", async () => {
    mocks.getOrganiserSession.mockResolvedValue(null);

    const res = await completeReq({ key: KEY, type: "photo", contentType: "image/jpeg" });

    expect(res.status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
