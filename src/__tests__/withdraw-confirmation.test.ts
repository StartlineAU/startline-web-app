import { describe, it, expect } from "vitest";
import {
  WITHDRAW_CODE_LENGTH,
  generateWithdrawCode,
  sanitiseWithdrawInput,
  withdrawCodeMatches,
} from "@/lib/withdraw-confirmation";

describe("generateWithdrawCode", () => {
  it("returns five digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateWithdrawCode()).toMatch(new RegExp(`^\\d{${WITHDRAW_CODE_LENGTH}}$`));
    }
  });

  it("is not the same code every time", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateWithdrawCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("sanitiseWithdrawInput", () => {
  it("drops non-digits and caps the length", () => {
    expect(sanitiseWithdrawInput(" 12-3a45 6")).toBe("12345");
  });
});

describe("withdrawCodeMatches", () => {
  it("accepts the exact code", () => {
    expect(withdrawCodeMatches("04821", "04821")).toBe(true);
  });

  it("ignores spaces typed between digits", () => {
    expect(withdrawCodeMatches("04821", "048 21")).toBe(true);
  });

  it("refuses a partial or wrong code", () => {
    expect(withdrawCodeMatches("04821", "0482")).toBe(false);
    expect(withdrawCodeMatches("04821", "04822")).toBe(false);
    expect(withdrawCodeMatches("04821", "")).toBe(false);
  });

  it("refuses everything before a code exists", () => {
    expect(withdrawCodeMatches("", "")).toBe(false);
  });
});
