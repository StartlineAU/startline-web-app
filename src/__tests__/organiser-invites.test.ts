import { describe, expect, it } from "vitest";
import { hashInviteToken, inviteIsFor, inviteState, newInviteToken } from "@/lib/organiser-invites";

describe("organiser invites", () => {
  it("stores only a hash of a long random token", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
    expect(a.tokenHash).toBe(hashInviteToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
  });

  it("knows pending, accepted and expired", () => {
    const now = new Date("2026-11-14T00:00:00Z");
    expect(inviteState({ acceptedAt: null, expiresAt: new Date("2026-11-15T00:00:00Z") }, now)).toBe("pending");
    expect(inviteState({ acceptedAt: null, expiresAt: now }, now)).toBe("expired");
    expect(inviteState({ acceptedAt: now, expiresAt: new Date("2026-11-15T00:00:00Z") }, now)).toBe("accepted");
  });

  it("matches the invited address case-insensitively, and nothing else", () => {
    expect(inviteIsFor({ email: "jade@example.com" }, " JADE@example.com ")).toBe(true);
    expect(inviteIsFor({ email: "jade@example.com" }, "jade@example.co")).toBe(false);
    expect(inviteIsFor({ email: "jade@example.com" }, "")).toBe(false);
    expect(inviteIsFor({ email: "jade@example.com" }, undefined)).toBe(false);
  });
});
