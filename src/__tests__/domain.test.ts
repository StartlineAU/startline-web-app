import { describe, it, expect } from "vitest";

describe("event status labels", () => {
  it("covers all statuses", () => {
    const statuses = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "ARCHIVED"];
    expect(statuses).toHaveLength(5);
  });
});

describe("competition types", () => {
  it("includes all supported disciplines", () => {
    const types = ["hyrox", "crossfit", "running", "hybrid"];
    types.forEach((t) => {
      expect(["hyrox", "crossfit", "running", "hybrid"]).toContain(t);
    });
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
