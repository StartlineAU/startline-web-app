import { describe, it, expect } from "vitest";
import { needsProfileOnboarding } from "@/lib/onboarding";

describe("needsProfileOnboarding", () => {
  it("is true until the age gate has been answered", () => {
    expect(needsProfileOnboarding({})).toBe(true);
    expect(needsProfileOnboarding({ dateOfBirth: null })).toBe(true);
    expect(needsProfileOnboarding({ dateOfBirth: "" })).toBe(true);
  });

  it("is false once a date of birth is stored", () => {
    expect(needsProfileOnboarding({ dateOfBirth: "1990-01-01" })).toBe(false);
  });
});
