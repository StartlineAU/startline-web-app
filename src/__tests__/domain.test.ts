import { describe, it, expect } from "vitest";
import { EVENT_TYPE_OPTIONS, EVENT_TYPE_LABELS } from "@/types";

describe("event status labels", () => {
  it("covers all statuses", () => {
    const statuses = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "ARCHIVED"];
    expect(statuses).toHaveLength(5);
  });
});

describe("competition types", () => {
  it("includes all supported disciplines", () => {
    const types = ["crossfit", "running", "hybrid", "swimming", "cycling", "triathlon"];
    expect(types).toHaveLength(6);
    types.forEach((t) => {
      expect(["crossfit", "running", "hybrid", "swimming", "cycling", "triathlon"]).toContain(t);
    });
  });
});

describe("EVENT_TYPE_OPTIONS", () => {
  it("has an entry for every EventType", () => {
    const optionValues = EVENT_TYPE_OPTIONS.map((o) => o.value);
    const labelKeys = Object.keys(EVENT_TYPE_LABELS);
    expect(optionValues.sort()).toEqual(labelKeys.sort());
  });

  it("each option has value, label, and shortLabel", () => {
    for (const opt of EVENT_TYPE_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
      expect(opt.shortLabel).toBeTruthy();
    }
  });
});

describe("Australian states", () => {
  it("has all 8 jurisdictions", () => {
    const states = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
    expect(states).toHaveLength(8);
  });
});

describe("registration statuses", () => {
  it("covers all registration states", () => {
    const statuses = ["CONFIRMED", "CANCELLED", "REFUNDED"];
    expect(statuses).toHaveLength(3);
  });
});
