import { describe, expect, it } from "vitest";
import { parsePosition } from "@/hooks/useDragPosition";

describe("parsePosition", () => {
  it("reads both percentages", () => {
    expect(parsePosition("37.5% 62%")).toEqual([37.5, 62]);
  });

  it("centres anything it cannot read", () => {
    expect(parsePosition(null)).toEqual([50, 50]);
    expect(parsePosition("")).toEqual([50, 50]);
    expect(parsePosition("left 20%")).toEqual([50, 20]);
  });
});
