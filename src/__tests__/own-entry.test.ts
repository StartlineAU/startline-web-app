import { describe, it, expect } from "vitest";
import { isOwnEntry } from "@/lib/own-entry";

const harper = { sub: "harper-sub", email: "Harper.Jones@startline.test" };
const entry = (over: Partial<Parameters<typeof isOwnEntry>[0]> = {}) => ({
  athleteUserId: null,
  athleteEmail: "harper.jones@startline.test",
  detailsPending: false,
  ...over,
});

describe("isOwnEntry", () => {
  it("is the athlete's own place when the email matches, whatever the case", () => {
    expect(isOwnEntry(entry(), harper)).toBe(true);
  });

  it("is not the buyer's place when they entered someone else on a group ticket", () => {
    expect(isOwnEntry(entry({ athleteEmail: "lachlan@startline.test" }), harper)).toBe(false);
  });

  it("follows the linked athlete over the email", () => {
    expect(isOwnEntry(entry({ athleteUserId: "harper-sub", athleteEmail: "old@startline.test" }), harper)).toBe(true);
    expect(isOwnEntry(entry({ athleteUserId: "someone-else" }), harper)).toBe(false);
  });

  it("does not count a team place still waiting for its member's details", () => {
    expect(isOwnEntry(entry({ detailsPending: true }), harper)).toBe(false);
  });
});
