import { describe, expect, it } from "vitest";
import { usernameAsTyped, usernameForSave, validateUsername } from "@/lib/username-validation";
import { containsProfanity } from "@/lib/profanity";

/**
 * The slur reported in issue #286 is kept base64-encoded so the literal does
 * not sit in the source tree. `SLUR` is the word the reporter used; `BYPASS` is
 * the exact string that defeated the old `bad-words` filter by gluing another
 * word onto the end of it.
 */
const SLUR = Buffer.from("bmlnZ2Vy", "base64").toString();
const BYPASS = `${SLUR}fucker`;

const reason = (username: string) => {
  const result = validateUsername(username);
  return result.valid ? null : result.reason;
};

describe("validateUsername - format rules", () => {
  it("accepts ordinary handles", () => {
    expect(validateUsername("matt-runs")).toEqual({ valid: true });
    expect(validateUsername("runner99")).toEqual({ valid: true });
    expect(validateUsername("a1b")).toEqual({ valid: true });
  });

  it("rejects empty, too short, and too long handles", () => {
    expect(reason("")).toMatch(/required/i);
    expect(reason("   ")).toMatch(/required/i);
    expect(reason("ab")).toMatch(/at least 3/i);
    expect(reason("a".repeat(31))).toMatch(/30 characters or less/i);
  });

  it("rejects invalid characters and edge separators", () => {
    expect(reason("Matt Runs")).toMatch(/lowercase letters/i);
    expect(reason("matt_runs")).toMatch(/lowercase letters/i);
    expect(reason("-matt")).toMatch(/lowercase letters/i);
    expect(reason("matt-")).toMatch(/lowercase letters/i);
  });

  it("rejects reserved route names", () => {
    expect(reason("admin")).toMatch(/reserved/i);
    expect(reason("organiser-setup")).toMatch(/reserved/i);
  });
});

describe("validateUsername - profanity (issue #286)", () => {
  it("blocks the slur and the compound that used to bypass the filter", () => {
    expect(reason(SLUR)).toMatch(/isn't allowed/i);
    expect(reason(BYPASS)).toMatch(/isn't allowed/i);
  });

  it.each([
    ["plain profanity", "fucker"],
    ["profanity as a suffix", "shitfucker"],
    ["profanity as a prefix", "fuckhead99"],
    ["profanity in the middle", "xxfuckerxx"],
    ["compound of two words", "buttfuck"],
    ["leetspeak substitution", "a55hole"],
    ["vowel substitution", "fvck"],
    ["stretched characters", "fuuuck"],
    ["hyphen-separated letters", "f-u-c-k"],
    ["hyphenated compound", "bitch-boy"],
  ])("blocks %s: %s", (_label, username) => {
    expect(reason(username)).toMatch(/isn't allowed/i);
  });

  it.each([
    "dickinson",
    "dickens",
    "dickson",
    "cummings",
    "cummins",
    "fagan",
    "penistone",
    "scunthorpe",
    "coonabarabran",
    "coonawarra",
    "spicer",
    "hancock",
    "peacock",
    "analyst",
    "assessment",
    "classic",
    "bassist",
    "shitake",
  ])("allows the legitimate name or word %s", (username) => {
    expect(validateUsername(username)).toEqual({ valid: true });
  });
});

describe("containsProfanity", () => {
  it("is case-insensitive and works on free text with spaces", () => {
    expect(containsProfanity("Matt Fucker")).toBe(true);
    expect(containsProfanity("FUCKER")).toBe(true);
    expect(containsProfanity(`Mr ${BYPASS}`)).toBe(true);
  });

  it("returns false for empty input and clean display names", () => {
    expect(containsProfanity("")).toBe(false);
    expect(containsProfanity("Emily Dickinson")).toBe(false);
    expect(containsProfanity("Sarah Cummings")).toBe(false);
  });
});

// Issue #591: a typed space becomes a hyphen, and that hyphen sat at the end of
// the field until the next word was typed, so the field warned about a
// character it had inserted itself.
describe("username drafts", () => {
  it("turns a typed space into a hyphen and keeps it for the next word", () => {
    expect(usernameAsTyped("John ")).toBe("john-");
    expect(usernameAsTyped("john- smith")).toBe("john-smith");
  });

  it("saves the draft without edge hyphens", () => {
    expect(usernameForSave("john-")).toBe("john");
    expect(usernameForSave(" -john-smith- ")).toBe("john-smith");
    expect(usernameForSave("---")).toBe("");
  });

  it("produces a valid username from a typed full name", () => {
    let draft = "";
    for (const ch of "John Smith ") draft = usernameAsTyped(draft + ch);
    expect(validateUsername(usernameForSave(draft))).toEqual({ valid: true });
    expect(usernameForSave(draft)).toBe("john-smith");
  });
});
