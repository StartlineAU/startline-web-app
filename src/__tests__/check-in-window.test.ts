import { describe, expect, it } from "vitest";
import { checkInWindow } from "@/lib/check-in-window";

const event = {
  eventDate: "2026-11-07",
  startTime: "07:00",
  endTime: "12:00",
  timeZone: "Australia/Sydney",
  status: "APPROVED",
  startsAtUtc: new Date("2026-11-06T20:00:00.000Z"),
  endsAtUtc: new Date("2026-11-07T01:00:00.000Z"),
};

describe("check-in window", () => {
  it("does not open until 60 minutes before the event", () => {
    const window = checkInWindow(event, new Date("2026-11-06T18:59:59.999Z"));

    expect(window.state).toBe("before");
    expect(window.opensAt?.toISOString()).toBe("2026-11-06T19:00:00.000Z");
    expect(window.closesAt?.toISOString()).toBe("2026-11-07T01:00:00.000Z");
  });

  it("opens exactly 60 minutes before the event", () => {
    expect(checkInWindow(event, new Date("2026-11-06T19:00:00.000Z")).state).toBe("open");
  });

  it("stays open after the event starts and until it ends", () => {
    expect(checkInWindow(event, new Date("2026-11-06T20:30:00.000Z")).state).toBe("open");
    expect(checkInWindow(event, new Date("2026-11-07T00:59:59.999Z")).state).toBe("open");
  });

  it("closes when the event ends", () => {
    expect(checkInWindow(event, new Date("2026-11-07T01:00:00.000Z")).state).toBe("closed");
  });

  it("falls back to the venue-local fields when derived UTC fields are missing", () => {
    const window = checkInWindow(
      {
        eventDate: "2026-11-07",
        startTime: "07:00",
        endTime: "12:00",
        state: "nsw",
        status: "APPROVED",
      },
      new Date("2026-11-06T19:30:00.000Z"),
    );

    expect(window.state).toBe("open");
    expect(window.opensAt?.toISOString()).toBe("2026-11-06T19:00:00.000Z");
    expect(window.closesAt?.toISOString()).toBe("2026-11-07T01:00:00.000Z");
  });

  it("fails closed for events that are not live", () => {
    expect(checkInWindow({ ...event, status: "COMPLETED" }, new Date("2026-11-06T19:30:00.000Z")).state)
      .toBe("unavailable");
  });

  it("fails closed when the event has no usable start", () => {
    expect(checkInWindow({
      eventDate: "not-a-date",
      startTime: "nope",
      endTime: "nope",
      status: "APPROVED",
    }).state).toBe("unavailable");
  });
});
