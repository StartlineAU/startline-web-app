import { describe, it, expect } from "vitest";
import {
  countCompletedRaces, racePhase, raceStatusLabel, withRacePhase,
} from "@/lib/profile-history";

const NOW = new Date("2026-11-19T00:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

const event = (status: string, startsInHours: number, endsInHours: number) => ({
  status,
  startsAtUtc: new Date(NOW + startsInHours * HOUR),
  endsAtUtc: new Date(NOW + endsInHours * HOUR),
});

describe("profile race history (#561)", () => {
  it("treats a confirmed entry for a future event as upcoming, not completed", () => {
    expect(racePhase(event("APPROVED", 48, 52), NOW)).toBe("upcoming");
    expect(raceStatusLabel("upcoming")).toBe("Upcoming");
  });

  it("is in progress between the start and the finish", () => {
    expect(racePhase(event("APPROVED", -1, 3), NOW)).toBe("in_progress");
    expect(raceStatusLabel("in_progress")).toBe("In progress");
  });

  it("is completed once the event has ended, even before the worker archives it", () => {
    expect(racePhase(event("APPROVED", -10, -6), NOW)).toBe("ended");
    expect(racePhase(event("ARCHIVED", -10, -6), NOW)).toBe("ended");
    expect(raceStatusLabel("ended")).toBe("Completed");
  });

  it("accepts ISO strings as well as dates", () => {
    expect(racePhase({ status: "APPROVED", startsAtUtc: null, endsAtUtc: new Date(NOW - HOUR).toISOString() }, NOW))
      .toBe("ended");
  });

  it("counts only ended races and strips the lifecycle columns", () => {
    const rows = withRacePhase([
      { id: "past", event: { title: "Past", ...event("ARCHIVED", -50, -46) } },
      { id: "next", event: { title: "Next", ...event("APPROVED", 50, 54) } },
      { id: "today", event: { title: "Today", ...event("IN_PROGRESS", -1, 2) } },
    ], NOW);

    expect(rows.map((r) => r.phase)).toEqual(["ended", "upcoming", "in_progress"]);
    expect(countCompletedRaces(rows)).toBe(1);
    expect(rows[0].event).toEqual({ title: "Past" });
  });
});
