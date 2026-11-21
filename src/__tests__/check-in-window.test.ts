import { describe, expect, it } from "vitest";
import { checkInLeadMinutesFor, checkInWindow } from "@/lib/check-in-window";

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

  it("is not custom when the organiser has not changed the opening", () => {
    expect(checkInWindow(event, new Date("2026-11-06T18:00:00.000Z")).custom).toBe(false);
  });
});

describe("organiser-chosen check-in opening (#543)", () => {
  const DAY = 24 * 60;

  it("opens the chosen lead before the start", () => {
    const early = { ...event, checkInLeadMinutes: DAY };
    const window = checkInWindow(early, new Date("2026-11-05T21:00:00.000Z"));

    expect(window.state).toBe("open");
    expect(window.custom).toBe(true);
    expect(window.leadMinutes).toBe(DAY);
    expect(window.opensAt?.toISOString()).toBe("2026-11-05T20:00:00.000Z");
  });

  it("is still before until the earlier opening arrives", () => {
    const early = { ...event, checkInLeadMinutes: DAY };
    expect(checkInWindow(early, new Date("2026-11-05T19:59:59.999Z")).state).toBe("before");
  });

  it("moves with the event when its start time changes", () => {
    const moved = {
      ...event,
      checkInLeadMinutes: DAY,
      startsAtUtc: new Date("2026-11-13T20:00:00.000Z"),
      endsAtUtc: new Date("2026-11-14T01:00:00.000Z"),
    };
    const window = checkInWindow(moved, new Date("2026-11-05T21:00:00.000Z"));

    expect(window.opensAt?.toISOString()).toBe("2026-11-12T20:00:00.000Z");
    expect(window.state).toBe("before");
  });

  it("follows the venue-local fields too when the derived UTC fields are missing", () => {
    const window = checkInWindow({
      eventDate: "2026-11-07",
      startTime: "07:00",
      endTime: "12:00",
      state: "nsw",
      status: "APPROVED",
      checkInLeadMinutes: 120,
    });

    expect(window.opensAt?.toISOString()).toBe("2026-11-06T18:00:00.000Z");
  });

  it("never opens later than the default", () => {
    const late = { ...event, checkInLeadMinutes: 15 };
    const window = checkInWindow(late, new Date("2026-11-06T19:10:00.000Z"));

    expect(window.state).toBe("open");
    expect(window.custom).toBe(false);
    expect(window.leadMinutes).toBe(60);
    expect(window.opensAt?.toISOString()).toBe("2026-11-06T19:00:00.000Z");
  });

  it("still closes at the event end", () => {
    const early = { ...event, checkInLeadMinutes: 7 * DAY };
    expect(checkInWindow(early, new Date("2026-11-07T01:00:00.000Z")).state).toBe("closed");
  });

  it("does not open check-in for an event that is not live", () => {
    const draft = { ...event, status: "DRAFT", checkInLeadMinutes: 7 * DAY };
    expect(checkInWindow(draft, new Date("2026-11-05T00:00:00.000Z")).state).toBe("unavailable");
  });

  const startsAt = event.startsAtUtc;

  it("stores Open now as the lead from now to the start", () => {
    const now = new Date("2026-11-04T20:00:00.000Z");
    expect(checkInLeadMinutesFor("now", startsAt, now)).toBe(2 * DAY);
    // Part minutes round up, so the athlete is never a minute short.
    expect(checkInLeadMinutesFor("now", startsAt, new Date("2026-11-04T20:00:30.000Z"))).toBe(2 * DAY);
  });

  it("stores a preset lead as it is", () => {
    expect(checkInLeadMinutesFor(DAY, startsAt)).toBe(DAY);
  });

  it("stores nothing for the default, or for a choice no earlier than it", () => {
    expect(checkInLeadMinutesFor("default", startsAt)).toBeNull();
    expect(checkInLeadMinutesFor(60, startsAt)).toBeNull();
    // "Now" inside the default window, or after the start, changes nothing.
    expect(checkInLeadMinutesFor("now", startsAt, new Date("2026-11-06T19:30:00.000Z"))).toBeNull();
    expect(checkInLeadMinutesFor("now", startsAt, new Date("2026-11-06T21:00:00.000Z"))).toBeNull();
  });
});
