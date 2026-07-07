import { describe, it, expect } from "vitest";
import { encodePrizePool, parsePrizePool, normalisePrizeAmount } from "@/lib/prize-pool";

describe("normalisePrizeAmount", () => {
  it("strips currency prefixes", () => {
    expect(normalisePrizeAmount("$2,000")).toBe("2,000");
    expect(normalisePrizeAmount("A$ 2,000")).toBe("2,000");
    expect(normalisePrizeAmount("2,000")).toBe("2,000");
  });

  it("trims whitespace", () => {
    expect(normalisePrizeAmount("  5,000  ")).toBe("5,000");
  });
});

describe("encodePrizePool", () => {
  it("encodes amount and details", () => {
    expect(encodePrizePool("2,000", "Awarded to podium finishers per division"))
      .toBe("Prize pool: 2,000 — Awarded to podium finishers per division");
  });

  it("encodes amount without details", () => {
    expect(encodePrizePool("2,000", "")).toBe("Prize pool: 2,000");
  });

  it("returns null for empty amount", () => {
    expect(encodePrizePool("", "some details")).toBeNull();
    expect(encodePrizePool("   ", "")).toBeNull();
  });

  it("strips currency prefix from amount", () => {
    expect(encodePrizePool("$2,000", "")).toBe("Prize pool: 2,000");
  });
});

describe("parsePrizePool", () => {
  it("round-trips encode output", () => {
    const encoded = encodePrizePool("8,000", "Awarded to podium finishers per division");
    expect(parsePrizePool(encoded)).toEqual({
      amount: "8,000",
      details: "Awarded to podium finishers per division",
    });
  });

  it("parses amount-only values", () => {
    expect(parsePrizePool("Prize pool: 5,000")).toEqual({ amount: "5,000", details: "" });
  });

  it("returns null for non-prize extras", () => {
    expect(parsePrizePool("Spectator tickets $15/day.")).toBeNull();
    expect(parsePrizePool(null)).toBeNull();
    expect(parsePrizePool(undefined)).toBeNull();
    expect(parsePrizePool("")).toBeNull();
  });
});
