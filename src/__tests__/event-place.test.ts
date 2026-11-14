import { describe, expect, it } from "vitest";
import { formatEventArea, formatEventPlace } from "@/lib/event-place";

// #530: a pending listing with no venue name showed ", Melbourne VIC", and
// one with no city ", VIC".
describe("formatEventPlace", () => {
  it("joins venue, city and state", () => {
    expect(formatEventPlace({ venue: "Olympic Park", city: "Melbourne", state: "vic" })).toBe("Olympic Park, Melbourne VIC");
  });

  it("drops a blank venue without leaving a comma", () => {
    expect(formatEventPlace({ venue: "", city: "Melbourne", state: "VIC" })).toBe("Melbourne VIC");
    expect(formatEventPlace({ venue: "   ", city: "Melbourne", state: "VIC" })).toBe("Melbourne VIC");
    expect(formatEventPlace({ venue: null, city: "Melbourne", state: "VIC" })).toBe("Melbourne VIC");
  });

  it("drops a blank city", () => {
    expect(formatEventPlace({ venue: "", city: "", state: "VIC" })).toBe("VIC");
    expect(formatEventPlace({ venue: "Olympic Park", city: "", state: "VIC" })).toBe("Olympic Park, VIC");
  });

  it("is empty when nothing is set", () => {
    expect(formatEventPlace({})).toBe("");
  });
});

describe("formatEventArea", () => {
  it("joins city and state", () => {
    expect(formatEventArea("Melbourne", "VIC")).toBe("Melbourne, VIC");
  });

  it("drops whichever is blank", () => {
    expect(formatEventArea("", "VIC")).toBe("VIC");
    expect(formatEventArea(" ", "Victoria")).toBe("Victoria");
    expect(formatEventArea("Melbourne", "")).toBe("Melbourne");
    expect(formatEventArea(null, undefined)).toBe("");
  });
});
