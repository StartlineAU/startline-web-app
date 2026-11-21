import { describe, expect, it } from "vitest";
import { checkInOpensAtFor, checkInWindow } from "@/lib/check-in-window";

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
  it("opens at the organiser's earlier time", () => {
    const early = { ...event, checkInOpensAt: new Date("2026-11-05T20:00:00.000Z") };
    const window = checkInWindow(early, new Date("2026-11-05T21:00:00.000Z"));

    expect(window.state).toBe("open");
    expect(window.custom).toBe(true);
    expect(window.opensAt?.toISOString()).toBe("2026-11-05T20:00:00.000Z");
  });

  it("is still before until the earlier time arrives", () => {
    const early = { ...event, checkInOpensAt: "2026-11-05T20:00:00.000Z" };
    expect(checkInWindow(early, new Date("2026-11-05T19:59:59.999Z")).state).toBe("before");
  });

  it("never opens later than the default", () => {
    const late = { ...event, checkInOpensAt: new Date("2026-11-06T19:30:00.000Z") };
    const window = checkInWindow(late, new Date("2026-11-06T19:10:00.000Z"));

    expect(window.state).toBe("open");
    expect(window.custom).toBe(false);
    expect(window.opensAt?.toISOString()).toBe("2026-11-06T19:00:00.000Z");
  });

  it("still closes at the event end", () => {
    const early = { ...event, checkInOpensAt: new Date("2026-11-01T00:00:00.000Z") };
    expect(checkInWindow(early, new Date("2026-11-07T01:00:00.000Z")).state).toBe("closed");
  });

  it("does not open check-in for an event that is not live", () => {
    const draft = { ...event, status: "DRAFT", checkInOpensAt: new Date("2026-11-01T00:00:00.000Z") };
    expect(checkInWindow(draft, new Date("2026-11-05T00:00:00.000Z")).state).toBe("unavailable");
  });

  const startsAt = event.startsAtUtc;

  it("stores the moment the organiser chose Open now", () => {
    const now = new Date("2026-11-01T03:00:00.000Z");
    expect(checkInOpensAtFor("now", startsAt, now)?.toISOString()).toBe(now.toISOString());
  });

  it("stores a lead time relative to the start", () => {
    expect(checkInOpensAtFor(24 * 60, startsAt)?.toISOString()).toBe("2026-11-05T20:00:00.000Z");
  });

  it("stores nothing for the default, or for a choice no earlier than it", () => {
    expect(checkInOpensAtFor("default", startsAt)).toBeNull();
    expect(checkInOpensAtFor(60, startsAt)).toBeNull();
    // "Now" inside the default window changes nothing.
    expect(checkInOpensAtFor("now", startsAt, new Date("2026-11-06T19:30:00.000Z"))).toBeNull();
  });
});
