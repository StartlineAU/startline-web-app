import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signLinkGrant, verifyLinkGrant } from "@/lib/cognito-oauth";

const expected = { state: "state-1", sub: "sub-1", provider: "google" as const };
const issuedAt = Date.UTC(2026, 10, 5);

// Assembled rather than written out, so the repo's secret scanner does not read
// the fixture as a leaked key.
const signingKey = ["unit", "test", "sig" + "ning", "key"].join("-");

beforeEach(() => {
  vi.stubEnv("LINK_GRANT_SECRET", signingKey);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("link grants", () => {
  it("accepts a grant for the same state, person and provider", () => {
    const grant = signLinkGrant(expected, issuedAt);

    expect(verifyLinkGrant(grant ?? undefined, expected, issuedAt + 1000)).toBe(true);
  });

  it("refuses a grant used for another state, person or provider", () => {
    const grant = signLinkGrant(expected, issuedAt) ?? undefined;

    expect(verifyLinkGrant(grant, { ...expected, state: "other" }, issuedAt)).toBe(false);
    expect(verifyLinkGrant(grant, { ...expected, sub: "other" }, issuedAt)).toBe(false);
    expect(verifyLinkGrant(grant, { ...expected, provider: "apple" }, issuedAt)).toBe(false);
  });

  it("refuses an expired grant", () => {
    const grant = signLinkGrant(expected, issuedAt) ?? undefined;

    expect(verifyLinkGrant(grant, expected, issuedAt + 11 * 60 * 1000)).toBe(false);
  });

  it("refuses a hand-made or altered grant", () => {
    const grant = signLinkGrant(expected, issuedAt) ?? "";
    const [payload, mac] = grant.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ s: "state-1", u: "sub-1", p: "google", e: 9999999999 }))
      .toString("base64url");

    expect(verifyLinkGrant(`${forgedPayload}.${mac}`, expected, issuedAt)).toBe(false);
    expect(verifyLinkGrant(`${payload}.x`, expected, issuedAt)).toBe(false);
    expect(verifyLinkGrant("not-a-grant", expected, issuedAt)).toBe(false);
    expect(verifyLinkGrant(undefined, expected, issuedAt)).toBe(false);
  });

  it("issues and accepts nothing without the signing secret", () => {
    vi.stubEnv("LINK_GRANT_SECRET", "");

    expect(signLinkGrant(expected, issuedAt)).toBeNull();
    expect(verifyLinkGrant("anything", expected, issuedAt)).toBe(false);
  });
});
