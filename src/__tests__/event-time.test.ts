import { describe, expect, it } from "vitest";
import {
  eventTimeData,
  eventUtcWindow,
  isValidEventDate,
  localDateTimeToUtc,
  timeZoneForState,
} from "@/lib/event-time";

const iso = (date: Date | null) => date?.toISOString() ?? null;

describe("event venue timezones", () => {
  it("maps every Australian jurisdiction to an IANA zone", () => {
    expect(timeZoneForState("nsw")).toBe("Australia/Sydney");
    expect(timeZoneForState("VIC")).toBe("Australia/Melbourne");
    expect(timeZoneForState("act")).toBe("Australia/Sydney");
    expect(timeZoneForState("tas")).toBe("Australia/Hobart");
    expect(timeZoneForState("qld")).toBe("Australia/Brisbane");
    expect(timeZoneForState("sa")).toBe("Australia/Adelaide");
    expect(timeZoneForState("nt")).toBe("Australia/Darwin");
    expect(timeZoneForState("wa")).toBe("Australia/Perth");
    expect(timeZoneForState("unknown")).toBe("Australia/Sydney");
  });

  it("converts Sydney summer and winter times correctly", () => {
    expect(iso(localDateTimeToUtc("2026-01-15", "09:00", "Australia/Sydney")))
      .toBe("2026-01-14T22:00:00.000Z");
    expect(iso(localDateTimeToUtc("2026-07-15", "09:00", "Australia/Sydney")))
      .toBe("2026-07-14T23:00:00.000Z");
  });

  it("handles half-hour offsets and no daylight saving", () => {
    expect(iso(localDateTimeToUtc("2026-07-15", "09:00", "Australia/Adelaide")))
      .toBe("2026-07-14T23:30:00.000Z");
    expect(iso(localDateTimeToUtc("2026-01-15", "09:00", "Australia/Brisbane")))
      .toBe("2026-01-14T23:00:00.000Z");
  });

  it("uses the offset in force on each side of a daylight-saving change", () => {
    // DST ends in Sydney on 5 April 2026 at 03:00.
    expect(iso(localDateTimeToUtc("2026-04-05", "01:30", "Australia/Sydney")))
      .toBe("2026-04-04T14:30:00.000Z");
    expect(iso(localDateTimeToUtc("2026-04-05", "03:30", "Australia/Sydney")))
      .toBe("2026-04-04T17:30:00.000Z");
  });

  it("rejects malformed dates and times", () => {
    expect(isValidEventDate("2026-02-30")).toBe(false);
    expect(isValidEventDate("2026-02-28")).toBe(true);
    expect(localDateTimeToUtc("not-a-date", "09:00", "Australia/Sydney")).toBeNull();
    expect(localDateTimeToUtc("2026-03-01", "25:00", "Australia/Sydney")).toBeNull();
  });
});

describe("event UTC window", () => {
  it("uses the end date for a multi-day event", () => {
    const window = eventUtcWindow({
      eventDate: "2026-11-07",
      endDate: "2026-11-08",
      startTime: "07:00",
      endTime: "16:00",
      state: "vic",
    });

    expect(window.timeZone).toBe("Australia/Melbourne");
    expect(iso(window.startsAtUtc)).toBe("2026-11-06T20:00:00.000Z");
    expect(iso(window.endsAtUtc)).toBe("2026-11-08T05:00:00.000Z");
  });

  it("treats a missing end time as the end of the event day", () => {
    const window = eventUtcWindow({
      eventDate: "2026-06-01",
      startTime: "07:00",
      endTime: "",
      state: "qld",
    });

    expect(iso(window.endsAtUtc)).toBe("2026-06-01T13:59:00.000Z");
  });

  it("returns derived fields for an event write", () => {
    expect(eventTimeData({
      eventDate: "2026-12-01",
      startTime: "06:00",
      endTime: "12:00",
      state: "wa",
    })).toMatchObject({
      timeZone: "Australia/Perth",
      startsAtUtc: new Date("2026-11-30T22:00:00.000Z"),
      endsAtUtc: new Date("2026-12-01T04:00:00.000Z"),
    });
  });
});
