import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { MetadataRoute } from "next";

// Middleware builds a Cognito verifier at import time; these cases never reach
// it, but the module still has to load without network access.
const { jwtVerify } = vi.hoisted(() => ({ jwtVerify: vi.fn() }));

vi.mock("jose", () => ({
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
  createRemoteJWKSet: () => async () => ({}),
}));

const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }));

vi.mock("next/headers", () => ({ headers: () => headersMock() }));

const CLIENT_ID = "testclientid";

let middleware: (req: NextRequest) => Promise<Response>;
let robots: () => Promise<MetadataRoute.Robots>;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_AWS_REGION = "ap-southeast-2";
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "ap-southeast-2_test";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = CLIENT_ID;
  ({ middleware } = await import("../../middleware"));
  ({ default: robots } = await import("../../app/robots"));
});

beforeEach(() => {
  jwtVerify.mockReset();
  headersMock.mockReset();
  delete process.env.PUBLIC_SITE_MODE;
});

function request(path: string, host: string) {
  return new NextRequest(new URL(`https://${host}${path}`), { headers: new Headers({ host }) });
}

/** Hosts that serve the whole app from one origin: staging, PR previews, dev. */
const NON_PRODUCTION_HOSTS = [
  "main.d1xamplifyapp.com.amplifyapp.com",
  "pr-302.d1abc2def3.amplifyapp.com",
  "localhost:3000",
  "127.0.0.1:3000",
];

const PRODUCTION_HOSTS = [
  "startlineau.com",
  "www.startlineau.com",
  "organiser.startlineau.com",
  "admin.startlineau.com",
];

describe("non-production hosts are not indexed", () => {
  it.each(NON_PRODUCTION_HOSTS)("marks %s noindex", async (host) => {
    const res = await middleware(request("/events", host));
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it.each(PRODUCTION_HOSTS)("leaves %s indexable", async (host) => {
    const res = await middleware(request("/events", host));
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });

  it("marks a redirect from a non-production host too", async () => {
    // A path the single-host router sends elsewhere still answers from staging,
    // so the crawler has to be told to stay out before it follows the hop.
    const res = await middleware(request("/organiser/dashboard", "main.d1xamplifyapp.com.amplifyapp.com"));
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("robots.txt", () => {
  it("disallows everything on a non-production host", async () => {
    headersMock.mockResolvedValue(new Headers({ host: "main.d1xamplifyapp.com.amplifyapp.com" }));
    const txt = await robots();
    expect(txt.rules).toMatchObject({ userAgent: "*", disallow: "/" });
    expect(txt.sitemap).toBeUndefined();
  });

  it("keeps the production rules, including the portals it always blocked", async () => {
    headersMock.mockResolvedValue(new Headers({ host: "startlineau.com" }));
    const txt = await robots();
    expect(txt.rules).toMatchObject({
      userAgent: "*",
      allow: expect.arrayContaining(["/", "/events"]),
      disallow: expect.arrayContaining(["/organiser", "/admin", "/api/"]),
    });
    expect(txt.sitemap).toBe("https://www.startlineau.com/sitemap.xml");
  });
});
