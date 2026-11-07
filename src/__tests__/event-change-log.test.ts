import { describe, it, expect } from "vitest";
import {
  FULL_REFUND_WINDOW_DAYS,
  baselineChanges,
  describeChangeValue,
  diffEventFields,
  fullRefundDeadline,
  materialChanges,
  materialGroupsChanged,
  serializeEventChange,
} from "@/lib/event-change-log";

const stored = {
  title: "Harbour 10K",
  discipline: "running",
  format: "Individual",
  eventDate: "2027-03-14",
  endDate: null,
  startTime: "07:00",
  endTime: "10:00",
  venue: "Albert Park",
  address: null,
  city: "Melbourne",
  state: "VIC",
  description: "<p>Flat and fast.</p>",
  cap: 500,
  waves: [{ label: "General", price: "45", closes: "", startTime: "" }],
  refundTiers: [{ daysBefore: 30, percent: 100 }],
};

describe("diffEventFields", () => {
  it("records each changed field with its before and after value", () => {
    const changes = diffEventFields(stored, { ...stored, eventDate: "2027-03-21", description: "<p>Hilly now.</p>" });

    expect(changes).toEqual([
      { field: "eventDate", label: "Start date", from: "2027-03-14", to: "2027-03-21", material: true },
      { field: "description", label: "Description", from: "<p>Flat and fast.</p>", to: "<p>Hilly now.</p>", material: false },
    ]);
  });

  it("never counts a field the edit leaves out", () => {
    expect(diffEventFields(stored, { title: "Harbour 10K", cap: undefined })).toEqual([]);
  });

  it("treats null, empty strings and empty arrays as the same blank value", () => {
    expect(diffEventFields(stored, { address: "", endDate: null })).toEqual([]);
    expect(diffEventFields({ photos: null }, { photos: [] })).toEqual([]);
  });

  it("ignores case and spacing on material text, so tidying a venue name costs nothing", () => {
    const changes = diffEventFields(stored, { venue: "  albert   park ", city: "MELBOURNE" });
    expect(changes).toEqual([]);
  });

  it("still sees case on non-material text", () => {
    expect(diffEventFields(stored, { title: "HARBOUR 10K" })).toHaveLength(1);
  });

  it("compares JSON fields by value, not key order", () => {
    const reordered = [{ startTime: "", closes: "", price: "45", label: "General" }];
    expect(diffEventFields(stored, { waves: reordered })).toEqual([]);
    expect(diffEventFields(stored, { waves: [{ ...reordered[0], price: "55" }] })).toHaveLength(1);
  });

  it("flags date, time, location and type changes as material and nothing else", () => {
    const changes = diffEventFields(stored, {
      startTime: "08:00", state: "NSW", format: "Teams", cap: 600, waves: [], title: "Renamed",
    });
    expect(materialChanges(changes).map((c) => c.field)).toEqual(["format", "startTime", "state"]);
    expect(materialGroupsChanged(changes)).toEqual(["date and time", "location", "event type"]);
  });
});

describe("baselineChanges", () => {
  it("records every populated field as the original details", () => {
    const baseline = baselineChanges(stored);
    expect(baseline.find((c) => c.field === "eventDate")).toEqual({
      field: "eventDate", label: "Start date", from: null, to: "2027-03-14", material: true,
    });
    // Blank fields are not "original information" worth recording.
    expect(baseline.some((c) => c.field === "address")).toBe(false);
  });
});

describe("fullRefundDeadline", () => {
  const changedAt = new Date("2027-01-01T00:00:00Z");

  it("runs for the window when the event is further away", () => {
    const deadline = fullRefundDeadline(changedAt, new Date("2027-06-01T00:00:00Z"));
    expect(deadline.getTime() - changedAt.getTime()).toBe(FULL_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  });

  it("ends when the event starts if that comes first", () => {
    const start = new Date("2027-01-05T21:00:00Z");
    expect(fullRefundDeadline(changedAt, start)).toEqual(start);
  });

  it("falls back to the window when the start is unknown", () => {
    expect(fullRefundDeadline(changedAt, null).getTime()).toBeGreaterThan(changedAt.getTime());
  });
});

describe("describeChangeValue", () => {
  it("reads ticket tiers and refund rules the way an organiser wrote them", () => {
    expect(describeChangeValue("waves", stored.waves)).toBe("General $45");
    expect(describeChangeValue("refundTiers", stored.refundTiers)).toBe("100% up to 30 days before");
  });

  it("strips markup from descriptions and says when a value was empty", () => {
    expect(describeChangeValue("description", stored.description)).toBe("Flat and fast.");
    expect(describeChangeValue("address", null)).toBe("(none)");
  });
});

describe("serializeEventChange", () => {
  const row = {
    id: "chg-1",
    kind: "EDIT" as const,
    source: "ADMIN" as const,
    changedByEmail: "marcus.stirling@startline.test",
    createdAt: new Date("2027-01-01T00:00:00Z"),
    statusAtChange: "APPROVED" as const,
    material: true,
    affectedCount: 3,
    fullRefundUntil: new Date("2027-01-15T00:00:00Z"),
    changes: diffEventFields(stored, { eventDate: "2027-03-21" }),
  };

  it("shows organisers Startline, not the admin's own address", () => {
    expect(serializeEventChange(row, "organiser").changedBy).toBe("Startline");
    expect(serializeEventChange(row, "admin").changedBy).toBe("marcus.stirling@startline.test");
  });

  it("describes each line for display", () => {
    expect(serializeEventChange(row, "admin").lines).toEqual([
      { field: "eventDate", label: "Start date", from: "2027-03-14", to: "2027-03-21", material: true },
    ]);
  });
});
