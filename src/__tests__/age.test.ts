import { describe, it, expect } from "vitest";
import { calcAge, isAtLeastYearsOld, MIN_AGE } from "@/lib/age";

// A fixed "today" keeps these stable forever.
const NOW = new Date(Date.UTC(2026, 9, 18)); // 2026-10-18

describe("calcAge", () => {
  it("counts a birthday today as reached", () => {
    expect(calcAge("2008-10-18", NOW)).toBe(18);
  });

  it("counts someone a day short of their birthday as younger", () => {
    expect(calcAge("2008-10-19", NOW)).toBe(17);
  });

  it("handles a birthday later in the year", () => {
    expect(calcAge("2008-12-31", NOW)).toBe(17);
  });

  it("handles a birthday earlier in the year", () => {
    expect(calcAge("2008-01-01", NOW)).toBe(18);
  });

  it("rejects dates that do not exist", () => {
    expect(calcAge("2008-02-30", NOW)).toBeNull();
    expect(calcAge("2008-13-01", NOW)).toBeNull();
  });

  it("rejects malformed and future dates", () => {
    expect(calcAge("18/10/2008", NOW)).toBeNull();
    expect(calcAge("", NOW)).toBeNull();
    expect(calcAge("2030-01-01", NOW)).toBeNull();
  });
});

describe("isAtLeastYearsOld", () => {
  it("defaults to the shared minimum age", () => {
    expect(MIN_AGE).toBe(18);
    expect(isAtLeastYearsOld("2008-10-18")).toBe(true);
    expect(isAtLeastYearsOld("2010-10-18")).toBe(false);
  });

  it("treats an unparseable date as not old enough", () => {
    expect(isAtLeastYearsOld("not-a-date")).toBe(false);
  });
});
