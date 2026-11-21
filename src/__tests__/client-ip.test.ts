import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { constantTimeEqual, edgeProofMissing } from "@/lib/edge-proof";

const ORIGINAL_SECRET = process.env.EDGE_SHARED_SECRET;
const SECRET = "edge-secret-for-tests";

function request(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/places/geocode", { headers });
}

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.EDGE_SHARED_SECRET;
  else process.env.EDGE_SHARED_SECRET = ORIGINAL_SECRET;
});

describe("getClientIp", () => {
  it("uses the nearest X-Forwarded-For hop appended by the proxy", () => {
    // The caller sent the left hand value; CloudFront appended the real one.
    const ip = getClientIp(request({ "x-forwarded-for": "203.0.113.9, 198.51.100.7" }));
    expect(ip).toBe("198.51.100.7");
  });

  it("ignores CF-Connecting-IP when no edge secret is configured", () => {
    delete process.env.EDGE_SHARED_SECRET;
    const ip = getClientIp(
      request({
        "cf-connecting-ip": "203.0.113.9",
        "x-startline-edge": SECRET,
        "x-forwarded-for": "198.51.100.7",
      }),
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("ignores CF-Connecting-IP when the edge secret does not match", () => {
    process.env.EDGE_SHARED_SECRET = SECRET;
    const ip = getClientIp(
      request({
        "cf-connecting-ip": "203.0.113.9",
        "x-startline-edge": "guessed",
        "x-forwarded-for": "198.51.100.7",
      }),
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("trusts CF-Connecting-IP when the request carries the edge secret", () => {
    process.env.EDGE_SHARED_SECRET = SECRET;
    const ip = getClientIp(
      request({
        "cf-connecting-ip": "203.0.113.9",
        "x-startline-edge": SECRET,
        "x-forwarded-for": "198.51.100.7",
      }),
    );
    expect(ip).toBe("203.0.113.9");
  });

  it("falls back to the nearest forwarded hop when Cloudflare sends no address", () => {
    process.env.EDGE_SHARED_SECRET = SECRET;
    const ip = getClientIp(request({ "x-startline-edge": SECRET, "x-forwarded-for": "198.51.100.7" }));
    expect(ip).toBe("198.51.100.7");
  });

  it("returns a stable bucket when no client address is present", () => {
    expect(getClientIp(request({}))).toBe("unknown");
  });
});

describe("edgeProofMissing", () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it("refuses nothing while the edge secret is unset", () => {
    delete process.env.EDGE_SHARED_SECRET;
    expect(edgeProofMissing("/events", headers({}))).toBe(false);
  });

  it("refuses a request without the edge secret once it is set", () => {
    process.env.EDGE_SHARED_SECRET = SECRET;
    expect(edgeProofMissing("/events", headers({}))).toBe(true);
    expect(edgeProofMissing("/api/checkout", headers({ "x-startline-edge": "nope" }))).toBe(true);
  });

  it("lets a request through Cloudflare pass", () => {
    process.env.EDGE_SHARED_SECRET = SECRET;
    expect(edgeProofMissing("/events", headers({ "x-startline-edge": SECRET }))).toBe(false);
  });

  it("leaves machine routes with their own credential reachable directly", () => {
    process.env.EDGE_SHARED_SECRET = SECRET;
    expect(edgeProofMissing("/api/internal/events/lifecycle", headers({}))).toBe(false);
  });
});

describe("constantTimeEqual", () => {
  it("matches only identical strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "a")).toBe(false);
  });
});
