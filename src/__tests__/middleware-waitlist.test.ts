import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Middleware verifies the Cognito access token before it will let anyone past
// the waitlist. The keys never change in a test, so the verifier is replaced
// with one that returns whatever payload the case needs — including throwing,
// which is what a stale or tampered token does.
const { jwtVerify } = vi.hoisted(() => ({ jwtVerify: vi.fn() }));

vi.mock("jose", () => ({
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
  createRemoteJWKSet: () => async () => ({}),
}));

const CLIENT_ID = "testclientid";
const AUTH = `CognitoIdentityServiceProvider.${CLIENT_ID}`;

let middleware: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_AWS_REGION = "ap-southeast-2";
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "ap-southeast-2_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = CLIENT_ID;
  ({ middleware } = await import("../../middleware"));
});

beforeEach(() => {
  jwtVerify.mockReset();
  delete process.env.PUBLIC_SITE_MODE;
});

function request(
  path: string,
  { host = "startlineau.com", signedIn = false }: { host?: string; signedIn?: boolean } = {},
) {
  const headers = new Headers({ host });
  if (signedIn) {
    headers.set(
      "cookie",
      `${AUTH}.LastAuthUser=someone; ${AUTH}.someone.accessToken=token`,
    );
  }
  return new NextRequest(new URL(`https://${host}${path}`), { headers });
}

/** A rewrite response carries the destination in this header. */
function rewriteTarget(res: Response): string | null {
  return res.headers.get("x-middleware-rewrite");
}

function passedThrough(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1";
}

describe("athlete host in waitlist mode", () => {
  it("sends an anonymous visitor to the waitlist", async () => {
    const res = await middleware(request("/"));
    expect(rewriteTarget(res)).toMatch(/\/waitlist$/);
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("sends www to the waitlist too", async () => {
    const res = await middleware(request("/events", { host: "www.startlineau.com" }));
    expect(rewriteTarget(res)).toMatch(/\/waitlist$/);
  });

  it("serves the waitlist versions of the legal pages", async () => {
    for (const path of ["/terms", "/privacy", "/cookies"]) {
      const res = await middleware(request(path));
      expect(rewriteTarget(res)).toMatch(new RegExp(`/waitlist${path}$`));
    }
  });

  it("lets an admin through and forbids caching that response", async () => {
    jwtVerify.mockResolvedValue({
      payload: { sub: "admin-sub", "cognito:groups": ["admins"] },
    });

    const res = await middleware(request("/", { signedIn: true }));

    expect(passedThrough(res)).toBe(true);
    expect(rewriteTarget(res)).toBeNull();
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("keeps an ordinary signed-in athlete on the waitlist", async () => {
    jwtVerify.mockResolvedValue({
      payload: { sub: "user-sub", "cognito:groups": ["organisers"] },
    });

    const res = await middleware(request("/", { signedIn: true }));

    expect(rewriteTarget(res)).toMatch(/\/waitlist$/);
  });

  it("keeps a token with no groups on the waitlist", async () => {
    jwtVerify.mockResolvedValue({ payload: { sub: "user-sub" } });

    const res = await middleware(request("/events", { signedIn: true }));

    expect(rewriteTarget(res)).toMatch(/\/waitlist$/);
  });

  it("keeps a stale or tampered token on the waitlist", async () => {
    jwtVerify.mockRejectedValue(new Error("signature verification failed"));

    const res = await middleware(request("/", { signedIn: true }));

    expect(rewriteTarget(res)).toMatch(/\/waitlist$/);
  });

  it("lets an admin reach the legal pages as the real documents", async () => {
    jwtVerify.mockResolvedValue({
      payload: { sub: "admin-sub", "cognito:groups": ["admins"] },
    });

    const res = await middleware(request("/terms", { signedIn: true }));

    expect(passedThrough(res)).toBe(true);
    expect(rewriteTarget(res)).toBeNull();
  });

  it("keeps the operational paths the public gate cannot block", async () => {
    for (const path of ["/waitlist", "/api/stripe/webhook", "/organiser-setup"]) {
      const res = await middleware(request(path));
      expect(passedThrough(res), path).toBe(true);
    }
    // Not verified: an anonymous caller never reaches Cognito.
    expect(jwtVerify).not.toHaveBeenCalled();
  });
});

describe("athlete host in live mode", () => {
  beforeEach(() => {
    process.env.PUBLIC_SITE_MODE = "live";
  });

  it("serves the real site to an anonymous visitor", async () => {
    const res = await middleware(request("/"));
    expect(passedThrough(res)).toBe(true);
    expect(rewriteTarget(res)).toBeNull();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("serves the real legal pages rather than the waitlist copies", async () => {
    const res = await middleware(request("/terms"));
    expect(passedThrough(res)).toBe(true);
  });

  it("keeps the waitlist page reachable", async () => {
    const res = await middleware(request("/waitlist"));
    expect(passedThrough(res)).toBe(true);
  });

  it("still protects the organiser portal paths", async () => {
    const res = await middleware(request("/organiser/dashboard"));
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("still protects the admin portal paths", async () => {
    const res = await middleware(request("/admin/dashboard"));
    expect(res.headers.get("location")).toMatch(/\/admin\/login$/);
  });
});

describe("other hosts", () => {
  it("does not gate the staging host", async () => {
    const res = await middleware(request("/events", { host: "staging.startlineau.com" }));
    expect(passedThrough(res)).toBe(true);
  });

  it("does not gate localhost", async () => {
    const res = await middleware(request("/events", { host: "localhost:3000" }));
    expect(passedThrough(res)).toBe(true);
  });
});
