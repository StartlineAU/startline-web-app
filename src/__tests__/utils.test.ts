import { describe, it, expect } from "vitest";
import { cn, formatEventDate, formatShortDate, formatTime, formatCompetitionFormat, formatExperienceLevel, truncateTitle, filterEvents, sortEventsByDate, getUpcomingEvents, getTotalUpcomingEvents } from "@/lib/utils";
import type { UserEvent, FilterState } from "@/types";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false, undefined, null, "", "bar")).toBe("foo bar");
  });

  it("resolves Tailwind conflicts - later classes win", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
  });

  it("handles conditional classes", () => {
    const active = true;
    expect(cn("base", active && "active")).toBe("base active");
    expect(cn("base", !active && "active")).toBe("base");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles key-value objects", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });
});

describe("formatEventDate", () => {
  it("formats an ISO date string into a readable format", () => {
    const result = formatEventDate("2026-07-15");
    expect(result).toContain("15");
    expect(result).toContain("July");
    expect(result).toContain("2026");
  });
});

describe("formatShortDate", () => {
  it("formats as day and month abbreviation", () => {
    const result = formatShortDate("2026-12-25");
    expect(result).toBe("25 Dec");
  });
});

describe("formatTime", () => {
  it("converts 24h to 12h AM/PM", () => {
    expect(formatTime("07:00")).toBe("7:00 AM");
    expect(formatTime("14:30")).toBe("2:30 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });
});

describe("formatCompetitionFormat", () => {
  it("capitalises format labels", () => {
    expect(formatCompetitionFormat("team")).toBe("Team");
    expect(formatCompetitionFormat("both")).toBe("Individual & Team");
    expect(formatCompetitionFormat("individual")).toBe("Individual");
  });
});

describe("formatExperienceLevel", () => {
  it("capitalises level labels", () => {
    expect(formatExperienceLevel("elite")).toBe("Elite");
    expect(formatExperienceLevel("beginner")).toBe("Beginner");
    expect(formatExperienceLevel("open")).toBe("Open");
  });
});

describe("truncateTitle", () => {
  it("returns the full title when short enough", () => {
    expect(truncateTitle("Sydney Fitness Race", 28)).toBe("Sydney Fitness Race");
  });

  it("truncates with ellipsis for long titles", () => {
    expect(truncateTitle("The Most Amazing CrossFit Competition Ever Held in Australia This Year", 28))
      .toBe("The Most Amazing CrossFit Co…");
  });
});

describe("sortEventsByDate", () => {
  it("sorts events by date ascending", () => {
    const events = [
      { date: "2026-07-15" } as UserEvent,
      { date: "2026-05-10" } as UserEvent,
      { date: "2026-09-01" } as UserEvent,
    ];
    const sorted = sortEventsByDate(events);
    expect(sorted[0].date).toBe("2026-05-10");
    expect(sorted[1].date).toBe("2026-07-15");
    expect(sorted[2].date).toBe("2026-09-01");
  });
});

describe("filterEvents", () => {
  const baseEvents: UserEvent[] = [
    { date: "2026-08-20", type: "crossfit", state: "vic", format: "team", title: "CrossFit Melbourne", city: "Melbourne", location: "Melbourne Arena" } as UserEvent,
    { date: "2025-01-01", type: "running", state: "qld", format: "individual", title: "Old Event", city: "Brisbane", location: "GABBA" } as UserEvent,
  ];

  const emptyFilters: FilterState = { types: [], states: [], format: null, dateRange: "all", searchQuery: "" };

  it("excludes past events", () => {
    const result = filterEvents(baseEvents, emptyFilters);
    const dates = result.map((e) => e.date);
    expect(dates).not.toContain("2025-01-01");
  });

  it("filters by type", () => {
    const result = filterEvents(baseEvents, { ...emptyFilters, types: ["crossfit"] });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("crossfit");
  });

  it("filters by state", () => {
    const result = filterEvents(baseEvents, { ...emptyFilters, states: ["vic"] });
    expect(result).toHaveLength(1);
    expect(result[0].state).toBe("vic");
  });

  it("filters by format", () => {
    const result = filterEvents(baseEvents, { ...emptyFilters, format: "team" });
    expect(result).toHaveLength(1);
    expect(result[0].format).toBe("team");
  });
});

describe("getUpcomingEvents", () => {
  it("returns events sorted and limited", () => {
    const today = new Date();
    const future = (d: number) => new Date(today.getTime() + d * 86400000).toISOString().split("T")[0];
    const events: UserEvent[] = [
      { date: future(5) } as UserEvent,
      { date: future(20) } as UserEvent,
      { date: future(60) } as UserEvent,
    ];
    const result = getUpcomingEvents(events, 2);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe(future(5));
  });
});

describe("getTotalUpcomingEvents", () => {
  it("counts only future events", () => {
    const events: UserEvent[] = [
      { date: "2026-10-10" } as UserEvent,
      { date: "2020-01-01" } as UserEvent,
    ];
    expect(getTotalUpcomingEvents(events)).toBe(1);
  });
});
