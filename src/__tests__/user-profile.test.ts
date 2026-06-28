import { describe, it, expect } from "vitest";
import {
  levelFromPoints,
  getLevelProgress,
  levelName,
  POINTS_PER_REGISTRATION,
  LEVEL_THRESHOLDS,
} from "@/lib/user-level";
import {
  isUpcomingEventDate,
  splitRegistrationsByDate,
  todayIsoDate,
} from "@/lib/user-registrations";

describe("user-level", () => {
  it("starts at level 1 with zero points", () => {
    expect(levelFromPoints(0)).toBe(1);
    expect(levelName(1)).toBe("Newcomer");
  });

  it("levels up at thresholds", () => {
    expect(levelFromPoints(99)).toBe(1);
    expect(levelFromPoints(100)).toBe(2);
    expect(levelFromPoints(LEVEL_THRESHOLDS[4])).toBe(5);
  });

  it("calculates progress toward next level", () => {
    const progress = getLevelProgress(150);
    expect(progress.level).toBe(2);
    expect(progress.pointsToNextLevel).toBe(100);
    expect(progress.nextLevel).toBe(3);
  });

  it("marks max level with full progress", () => {
    const maxPoints = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    const progress = getLevelProgress(maxPoints);
    expect(progress.nextLevel).toBeNull();
    expect(progress.progressPercent).toBe(100);
  });

  it("awards 100 points per registration constant", () => {
    expect(POINTS_PER_REGISTRATION).toBe(100);
  });
});

describe("user-registrations", () => {
  it("uses ISO date string for today", () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("splits registrations into upcoming and past", () => {
    const regs = [
      { event: { eventDate: "2099-01-01" } },
      { event: { eventDate: "2020-01-01" } },
      { event: { eventDate: todayIsoDate() } },
    ];

    const { upcoming, past } = splitRegistrationsByDate(regs);
    expect(upcoming).toHaveLength(2);
    expect(past).toHaveLength(1);
    expect(isUpcomingEventDate("2099-01-01")).toBe(true);
    expect(isUpcomingEventDate("2020-01-01")).toBe(false);
  });
});
