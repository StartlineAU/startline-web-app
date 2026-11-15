import { describe, it, expect } from "vitest";
import {
  groupOrderTeams,
  holdsTeamPlace,
  pendingMemberName,
  pendingMemberNumbers,
  teamTierChangeError,
} from "@/lib/team-tickets";
import { findTeamResultConflict, pickTeamResult } from "@/lib/team-results";
import { EMPTY_WAVE, wavesForFormat } from "@/components/event/event-form/shared";

describe("teamTierChangeError (#541)", () => {
  const pairs = { label: "Pairs", price: "40", teamSize: 2 };
  const solo = { label: "Solo", price: "50" };

  it("allows any change to a tier nobody has entered", () => {
    expect(teamTierChangeError({
      previousWaves: [pairs],
      nextWaves: [{ ...pairs, teamSize: 4 }],
      labelsWithEntries: [],
    })).toBeNull();
  });

  it("refuses a new team size on a tier with entries", () => {
    const error = teamTierChangeError({
      previousWaves: [pairs],
      nextWaves: [{ ...pairs, teamSize: 4 }],
      labelsWithEntries: ["Pairs"],
    });
    expect(error).toMatch(/"Pairs" already has entries as teams of 2/);
    expect(error).toMatch(/teams of 4/);
  });

  it("refuses switching a sold tier between individual and team, either way", () => {
    expect(teamTierChangeError({
      previousWaves: [pairs],
      nextWaves: [{ label: "Pairs", price: "40" }],
      labelsWithEntries: ["Pairs"],
    })).toMatch(/cannot change to individual/);
    expect(teamTierChangeError({
      previousWaves: [solo],
      nextWaves: [{ ...solo, teamSize: 2 }],
      labelsWithEntries: ["Solo"],
    })).toMatch(/as individual/);
  });

  it("lets price and quantity change on a sold team tier", () => {
    expect(teamTierChangeError({
      previousWaves: [pairs],
      nextWaves: [{ ...pairs, price: "45", qty: 20 }],
      labelsWithEntries: ["Pairs"],
    })).toBeNull();
  });

  it("refuses a format-only change to Individual while team tickets remain", () => {
    expect(teamTierChangeError({
      previousWaves: [pairs],
      nextWaves: [pairs],
      nextFormat: "individual",
      labelsWithEntries: [],
    })).toMatch(/individual event cannot sell team tickets/);
  });
});

describe("holdsTeamPlace", () => {
  it("counts confirmed and refund-requested members, not those who left", () => {
    expect(holdsTeamPlace("CONFIRMED")).toBe(true);
    expect(holdsTeamPlace("REFUND_REQUESTED")).toBe(true);
    expect(holdsTeamPlace("REFUNDED")).toBe(false);
    expect(holdsTeamPlace("CANCELLED")).toBe(false);
  });
});

describe("team results", () => {
  const team = ["a", "b", "c"];
  const teammates = new Map([["a", team], ["b", team], ["c", team], ["solo", ["solo"]]]);

  it("shares distance, time and placement, but not personal flags", () => {
    expect(pickTeamResult({ resultTime: "41:05", resultPlacement: "3", isPersonalBest: true }))
      .toEqual({ resultTime: "41:05", resultPlacement: "3" });
  });

  it("refuses two rows that give one team different times", () => {
    const conflict = findTeamResultConflict(
      [
        { id: "a", data: { resultTime: "41:05" } },
        { id: "b", data: { resultTime: "41:30" } },
      ],
      teammates,
    );
    expect(conflict).toEqual({ registrationIds: ["a", "b"], field: "resultTime", label: "time" });
  });

  it("refuses a row that clears a time another row sets", () => {
    expect(findTeamResultConflict(
      [
        { id: "a", data: { resultTime: "41:05" } },
        { id: "b", data: { resultTime: null } },
      ],
      teammates,
    )).not.toBeNull();
  });

  it("accepts rows that agree, or that set different fields", () => {
    expect(findTeamResultConflict(
      [
        { id: "a", data: { resultTime: "41:05" } },
        { id: "b", data: { resultTime: "41:05", resultPlacement: "3" } },
        { id: "c", data: { isPersonalBest: true } },
      ],
      teammates,
    )).toBeNull();
  });

  it("ignores individual entries", () => {
    expect(findTeamResultConflict(
      [
        { id: "solo", data: { resultTime: "41:05" } },
        { id: "solo", data: { resultTime: "50:00" } },
      ],
      teammates,
    )).toBeNull();
  });
});

describe("members left for later (#541)", () => {
  const waves = [{ label: "Solo" }, { label: "Squad", teamSize: 3 }];

  it("lets any member but the first be left for later", () => {
    const result = groupOrderTeams(
      [
        { waveLabel: "Squad", team: 0 },
        { waveLabel: "Squad", team: 0, pending: true },
        { waveLabel: "Squad", team: 0, pending: true },
      ],
      waves,
      ["Trio"],
    );
    expect("teams" in result).toBe(true);
  });

  it("refuses a team whose first member is left for later", () => {
    const result = groupOrderTeams(
      [
        { waveLabel: "Squad", team: 0, pending: true },
        { waveLabel: "Squad", team: 0 },
        { waveLabel: "Squad", team: 0 },
      ],
      waves,
      ["Trio"],
    );
    expect(result).toEqual({ error: "Each team's first member needs their details at checkout." });
  });

  it("refuses an individual ticket left for later", () => {
    expect(groupOrderTeams([{ waveLabel: "Solo", pending: true }], waves, [])).toEqual({
      error: "Every individual ticket needs the athlete's details.",
    });
  });

  it("numbers each pending place by its position in the team", () => {
    const teams = [{ index: 0, name: "Trio", waveLabel: "Squad", size: 3, members: [2, 3, 4] }];
    const numbers = pendingMemberNumbers(teams, (i) => i === 3 || i === 4);
    expect([...numbers]).toEqual([[3, 2], [4, 3]]);
    expect(pendingMemberName(2)).toBe("Team member 2");
  });
});

describe("wavesForFormat (#541)", () => {
  const ticket = (teamSize: string) => ({ ...EMPTY_WAVE, label: "General", price: "40", teamSize });

  it("makes every ticket a team ticket when the event becomes Team", () => {
    // The ticket made before the format was picked had no size and, on a
    // Team event, no control to give it one.
    expect(wavesForFormat([ticket(""), ticket("4")], "team").map((w) => w.teamSize)).toEqual(["2", "4"]);
  });

  it("clears team sizes when the event becomes Individual", () => {
    expect(wavesForFormat([ticket("2"), ticket("")], "individual").map((w) => w.teamSize)).toEqual(["", ""]);
  });

  it("leaves each ticket alone on Individual & Team", () => {
    expect(wavesForFormat([ticket("2"), ticket("")], "both").map((w) => w.teamSize)).toEqual(["2", ""]);
  });
});
