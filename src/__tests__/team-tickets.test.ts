import { describe, it, expect } from "vitest";
import {
  confirmedUnitsByWave,
  groupOrderTeams,
  normaliseTeamName,
  peoplePerUnit,
  requestedUnitsByWave,
  teamSizeLabel,
  teamSizeOf,
} from "@/lib/team-tickets";
import { getCapacityError } from "@/lib/registration-capacity";
import { parseTeamNamesFromMetadata } from "@/lib/stripe-webhook";
import { eventPayloadSchema } from "@/lib/schemas";
import { eventCap, missingRequirements, waveTeamSize, INITIAL, EMPTY_WAVE } from "@/components/event/event-form/shared";

const waves = [
  { label: "Solo", qty: 50 },
  { label: "Pairs", qty: 10, teamSize: 2 },
  { label: "Squad", teamSize: 4 },
];

describe("teamSizeOf", () => {
  it("reads a team size of 2 to 10 and nothing else", () => {
    expect(teamSizeOf({ teamSize: 2 })).toBe(2);
    expect(teamSizeOf({ teamSize: 10 })).toBe(10);
    expect(teamSizeOf({ teamSize: "4" })).toBe(4);
    expect(teamSizeOf({ teamSize: 1 })).toBeNull();
    expect(teamSizeOf({ teamSize: 11 })).toBeNull();
    expect(teamSizeOf({ teamSize: 2.5 })).toBeNull();
    expect(teamSizeOf({})).toBeNull();
    expect(teamSizeOf(undefined)).toBeNull();
  });

  it("counts people per unit and labels the size", () => {
    expect(peoplePerUnit({ teamSize: 4 })).toBe(4);
    expect(peoplePerUnit({})).toBe(1);
    expect(teamSizeLabel(2)).toBe("Pairs");
    expect(teamSizeLabel(4)).toBe("Teams of 4");
  });

  it("normalises team names", () => {
    expect(normaliseTeamName("  Harbour   Hustlers ")).toBe("Harbour Hustlers");
    expect(normaliseTeamName(42)).toBe("");
  });
});

describe("groupOrderTeams", () => {
  it("groups members of each team and leaves individuals alone", () => {
    const result = groupOrderTeams(
      [
        { waveLabel: "Solo" },
        { waveLabel: "Pairs", team: 0 },
        { waveLabel: "Pairs", team: 0 },
        { waveLabel: "Pairs", team: 1 },
        { waveLabel: "Pairs", team: 1 },
      ],
      waves,
      ["Fast Feet", "Slow Coaches"],
    );
    expect(result).toEqual({
      teams: [
        { index: 0, name: "Fast Feet", waveLabel: "Pairs", size: 2, members: [1, 2] },
        { index: 1, name: "Slow Coaches", waveLabel: "Pairs", size: 2, members: [3, 4] },
      ],
    });
  });

  it("refuses a team that is short of the tier's size", () => {
    const result = groupOrderTeams([{ waveLabel: "Squad", team: 0 }, { waveLabel: "Squad", team: 0 }], waves, ["Four"]);
    expect(result).toEqual({ error: '"Four" needs exactly 4 members (it has 2).' });
  });

  it("refuses a team-ticket member with no team", () => {
    const result = groupOrderTeams([{ waveLabel: "Pairs" }, { waveLabel: "Pairs" }], waves, []);
    expect("error" in result && result.error).toMatch(/needs a team/);
  });

  it("refuses an individual ticket that names a team", () => {
    const result = groupOrderTeams([{ waveLabel: "Solo", team: 0 }], waves, ["Lonely"]);
    expect("error" in result && result.error).toMatch(/individual ticket/);
  });

  it("refuses one team spread over two tiers", () => {
    const result = groupOrderTeams(
      [{ waveLabel: "Pairs", team: 0 }, { waveLabel: "Squad", team: 0 }],
      waves,
      ["Mixed"],
    );
    expect("error" in result && result.error).toMatch(/same ticket/);
  });

  it("refuses blank, duplicate and unused team names", () => {
    const pair = (team: number) => [{ waveLabel: "Pairs", team }, { waveLabel: "Pairs", team }];
    expect(groupOrderTeams(pair(0), waves, ["  "])).toEqual({ error: "Every team needs a name." });
    expect(groupOrderTeams([...pair(0), ...pair(1)], waves, ["Same", "same"])).toEqual({
      error: 'Two teams in this order are called "same".',
    });
    expect(groupOrderTeams(pair(0), waves, ["A", "B"])).toEqual({ error: "Every team in the order needs members." });
  });
});

describe("team capacity units", () => {
  it("counts a team once against its tier", () => {
    expect(
      requestedUnitsByWave([
        { waveLabel: "Solo" },
        { waveLabel: "Solo" },
        { waveLabel: "Pairs", team: 0 },
        { waveLabel: "Pairs", team: 0 },
        { waveLabel: "Pairs", team: 1 },
        { waveLabel: "Pairs", team: 1 },
      ]),
    ).toEqual({ Solo: 2, Pairs: 2 });
  });

  it("counts confirmed teams, not their members", () => {
    expect(
      confirmedUnitsByWave([
        { waveLabel: "Solo", teamId: null, _count: { _all: 7 } },
        { waveLabel: "Pairs", teamId: "t1", _count: { _all: 2 } },
        { waveLabel: "Pairs", teamId: "t2", _count: { _all: 1 } },
      ]),
    ).toEqual({ Solo: 7, Pairs: 2 });
  });

  it("says teams, not tickets, when a team tier runs low", () => {
    expect(
      getCapacityError({
        cap: null,
        confirmedTotal: 0,
        requestedTotal: 4,
        waves,
        usedLabels: ["Pairs"],
        confirmedByWave: { Pairs: 9 },
        requestedByWave: { Pairs: 2 },
      }),
    ).toBe('Only 1 "Pairs" team left.');
  });
});

describe("parseTeamNamesFromMetadata", () => {
  it("reads the names and survives junk", () => {
    expect(parseTeamNamesFromMetadata({ teams: '["A","B"]' })).toEqual(["A", "B"]);
    expect(parseTeamNamesFromMetadata({ teams: "not json" })).toEqual([]);
    expect(parseTeamNamesFromMetadata({})).toEqual([]);
  });
});

describe("event payload team sizes", () => {
  const base = { title: "Relay", format: "team" };

  it("accepts a team size in range", () => {
    const parsed = eventPayloadSchema.safeParse({ ...base, waves: [{ label: "Pairs", price: "50", teamSize: 2 }] });
    expect(parsed.success).toBe(true);
  });

  it("rejects a team size out of range", () => {
    const parsed = eventPayloadSchema.safeParse({ ...base, waves: [{ label: "Huge", price: "50", teamSize: 12 }] });
    expect(parsed.success).toBe(false);
  });

  it("rejects team tickets on an individual event", () => {
    const parsed = eventPayloadSchema.safeParse({
      ...base,
      format: "individual",
      waves: [{ label: "Pairs", price: "50", teamSize: 2 }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("listing editor team tickets", () => {
  it("caps the event at people: teams times their size, plus individual tickets", () => {
    const form = {
      cap: "",
      waves: [
        { ...EMPTY_WAVE, label: "Solo", price: "40", qty: "20" },
        { ...EMPTY_WAVE, label: "Squad", price: "30", qty: "5", teamSize: "4" },
      ],
    };
    expect(eventCap(form)).toBe(40);
    expect(waveTeamSize(form.waves[1])).toBe(4);
  });

  it("asks for a team size on every ticket of a Team event", () => {
    const form = {
      ...INITIAL,
      format: "team" as const,
      waves: [{ ...EMPTY_WAVE, label: "General", price: "40" }],
    };
    expect(missingRequirements(form).map((r) => r.row)).toContain("Team tickets");
    const fixed = { ...form, waves: [{ ...form.waves[0], teamSize: "2" }] };
    expect(missingRequirements(fixed).map((r) => r.row)).not.toContain("Team tickets");
  });
});
