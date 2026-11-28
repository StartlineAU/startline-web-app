import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { entryClaimMatches, readEntryClaim, signEntryClaim } from "@/lib/entry-claim-token";

// The "Add to my profile" link in a confirmation email (#598).

describe("entry claim tokens", () => {
  const row = { id: "reg-1", athleteEmail: "Racer@X.test" };

  beforeEach(() => { vi.stubEnv("ENTRY_CLAIM_SECRET", "test-secret"); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("round-trips for the entry it was issued for, ignoring the address's case", () => {
    const token = signEntryClaim({ registrationId: row.id, athleteEmail: "racer@x.test" });
    const claim = readEntryClaim(token);
    expect(claim?.registrationId).toBe("reg-1");
    expect(claim && entryClaimMatches(claim, row)).toBe(true);
  });

  it("never carries the email address itself", () => {
    const token = signEntryClaim({ registrationId: row.id, athleteEmail: row.athleteEmail })!;
    const payload = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
    expect(payload.toLowerCase()).not.toContain("racer@x.test");
  });

  it("stops matching once the entry's address changes (a team swap)", () => {
    const claim = readEntryClaim(signEntryClaim({ registrationId: row.id, athleteEmail: row.athleteEmail }))!;
    expect(entryClaimMatches(claim, { id: row.id, athleteEmail: "new-member@x.test" })).toBe(false);
    expect(entryClaimMatches(claim, { id: "reg-2", athleteEmail: row.athleteEmail })).toBe(false);
  });

  it("rejects a tampered payload, a bad signature and junk", () => {
    const token = signEntryClaim({ registrationId: row.id, athleteEmail: row.athleteEmail })!;
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ r: "reg-2", h: "x" })).toString("base64url");
    expect(readEntryClaim(`${forged}.${sig}`)).toBeNull();
    expect(readEntryClaim(`${token}x`)).toBeNull();
    expect(readEntryClaim(`${token}.extra`)).toBeNull();
    expect(readEntryClaim("not-a-token")).toBeNull();
    expect(readEntryClaim("")).toBeNull();
    expect(readEntryClaim("a".repeat(600))).toBeNull();
  });

  it("rejects a token signed with another key", () => {
    const token = signEntryClaim({ registrationId: row.id, athleteEmail: row.athleteEmail });
    vi.stubEnv("ENTRY_CLAIM_SECRET", "rotated");
    expect(readEntryClaim(token)).toBeNull();
  });

  it("issues nothing, and accepts nothing, without a key", () => {
    const token = signEntryClaim({ registrationId: row.id, athleteEmail: row.athleteEmail });
    vi.stubEnv("ENTRY_CLAIM_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(signEntryClaim({ registrationId: row.id, athleteEmail: row.athleteEmail })).toBeNull();
    expect(readEntryClaim(token)).toBeNull();
    warn.mockRestore();
  });
});
