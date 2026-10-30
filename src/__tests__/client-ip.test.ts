import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "@/lib/client-ip";

const ORIGINAL_FLAG = process.env.TRUST_CF_CONNECTING_IP;

function request(headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/places/geocode", { headers });
}

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.TRUST_CF_CONNECTING_IP;
  else process.env.TRUST_CF_CONNECTING_IP = ORIGINAL_FLAG;
});

describe("getClientIp", () => {
  it("uses the nearest X-Forwarded-For hop appended by the proxy", () => {
    // The caller sent the left hand value; CloudFront appended the real one.
    const ip = getClientIp(request({ "x-forwarded-for": "203.0.113.9, 198.51.100.7" }));
    expect(ip).toBe("198.51.100.7");
  });

  it("ignores a spoofed CF-Connecting-IP when Cloudflare is not trusted", () => {
    delete process.env.TRUST_CF_CONNECTING_IP;
    const ip = getClientIp(
      request({
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.7",
      }),
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("trusts CF-Connecting-IP only when the origin is known to be Cloudflare-only", () => {
    process.env.TRUST_CF_CONNECTING_IP = "true";
    const ip = getClientIp(
      request({
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.7",
      }),
    );
    expect(ip).toBe("203.0.113.9");
  });

  it("falls back to the nearest forwarded hop without any proxy headers", () => {
    process.env.TRUST_CF_CONNECTING_IP = "true";
    const ip = getClientIp(request({ "x-forwarded-for": "198.51.100.7" }));
    expect(ip).toBe("198.51.100.7");
  });

  it("returns a stable bucket when no client address is present", () => {
    expect(getClientIp(request({}))).toBe("unknown");
  });
});
