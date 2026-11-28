import { describe, it, expect } from "vitest";
import { eventPayloadSchema } from "@/lib/schemas";
import { MAX_GALLERY_PHOTOS } from "@/lib/upload-limits";

describe("eventPayloadSchema time/date ordering", () => {
  it("rejects an end time at or before the start time", () => {
    const res = eventPayloadSchema.safeParse({ startTime: "09:00", endTime: "09:00" });
    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error.issues[0].message).toBe("End time must be after start time.");
  });

  it("accepts an end time after the start time", () => {
    const res = eventPayloadSchema.safeParse({ startTime: "09:00", endTime: "12:00" });
    expect(res.success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const res = eventPayloadSchema.safeParse({ eventDate: "2026-10-02", endDate: "2026-10-01" });
    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error.issues[0].message).toBe("End date must be on or after the start date.");
  });

  it("rejects a ticket category closing after the event ends", () => {
    const res = eventPayloadSchema.safeParse({
      eventDate: "2026-10-02",
      waves: [{ label: "General", price: "50", closes: "2026-10-03" }],
    });
    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error.issues[0].message).toBe("A ticket category cannot close after the event ends.");
  });

  it("allows a ticket category closing on or before the event end", () => {
    const res = eventPayloadSchema.safeParse({
      eventDate: "2026-10-02",
      waves: [{ label: "General", price: "50", closes: "2026-10-02" }],
    });
    expect(res.success).toBe(true);
  });

  it("does not block partial drafts missing one side of a comparison", () => {
    const res = eventPayloadSchema.safeParse({ startTime: "09:00" });
    expect(res.success).toBe(true);
  });
});

// The form stops at MAX_GALLERY_PHOTOS; the schema holds the same line for API
// callers, since raising the per-image size (issue #594) leaves count as the
// thing that bounds storage.
describe("eventPayloadSchema gallery size", () => {
  const photos = (n: number) => Array.from({ length: n }, (_, i) => `/uploads/photo-${i}.jpg`);

  it("accepts a full gallery", () => {
    expect(eventPayloadSchema.safeParse({ photos: photos(MAX_GALLERY_PHOTOS) }).success).toBe(true);
  });

  it("rejects one photo over the gallery limit", () => {
    const res = eventPayloadSchema.safeParse({ photos: photos(MAX_GALLERY_PHOTOS + 1) });
    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error.issues[0].message).toBe(`An event can have up to ${MAX_GALLERY_PHOTOS} gallery photos.`);
  });
});

// The reposition control writes "x% y%", and the value lands in a style
// attribute on the public page, so nothing else gets through (#586).
describe("eventPayloadSchema cover position", () => {
  it.each(["50% 50%", "0.0% 100.0%", "37.5% 62.0%", "100% 0%"])("accepts %s", (coverPosition) => {
    expect(eventPayloadSchema.safeParse({ coverPosition }).success).toBe(true);
  });

  it.each(["", "center", "50%", "101% 50%", "-5% 50%", "50% 50%; color: red", "50px 50px"])("rejects %j", (coverPosition) => {
    expect(eventPayloadSchema.safeParse({ coverPosition }).success).toBe(false);
  });

  it("accepts null, which falls back to the column default", () => {
    expect(eventPayloadSchema.safeParse({ coverPosition: null }).success).toBe(true);
  });
});
