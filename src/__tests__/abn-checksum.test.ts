import { describe, expect, it } from "vitest";
import { isValidAbn } from "@/lib/abn";
import { sanitizeWaveInput } from "@/lib/start-waves";

describe("isValidAbn", () => {
  it("accepts a real ABN, with or without spaces", () => {
    // The ATO's published example.
    expect(isValidAbn("51 824 753 556")).toBe(true);
    expect(isValidAbn("51824753556")).toBe(true);
  });

  it("refuses a wrong checksum, the wrong length or letters", () => {
    expect(isValidAbn("51824753557")).toBe(false);
    expect(isValidAbn("123456789")).toBe(false);
    expect(isValidAbn("5182475355a")).toBe(false);
    expect(isValidAbn("")).toBe(false);
  });
});

describe("wave names", () => {
  it("are at most 60 characters, since they are emailed to athletes", () => {
    expect(sanitizeWaveInput([{ label: "x".repeat(60) }])).not.toHaveProperty("error");
    expect(sanitizeWaveInput([{ label: "x".repeat(61) }])).toEqual({
      error: "A wave name can be at most 60 characters.",
    });
  });
});
