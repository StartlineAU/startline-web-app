import { describe, it, expect } from "vitest";
import {
  groupOrderTeams,
  holdsTeamPlace,
  pendingMemberName,
  pendingMemberNumbers,
  teamTierChangeError,
  formatFromTickets,
  ticketFormatLabel,
  withTicketFormat,
} from "@/lib/team-tickets";
import { findTeamResultConflict, pickTeamResult } from "@/lib/team-results";
import { formatCompetitionFormat } from "@/lib/utils";

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

describe("format from tickets (#541)", () => {
  const solo = { label: "Solo", price: "40" };
  const pairs = { label: "Pairs", price: "40", teamSize: 2 };
  const squad = { label: "Squad", price: "40", teamSize: 4 };
  const trio = { label: "Trio", price: "40", teamSize: 3 };

  it("stores individual, team or both from what the tickets are", () => {
    expect(formatFromTickets([solo])).toBe("individual");
    expect(formatFromTickets([pairs, squad])).toBe("team");
    expect(formatFromTickets([solo, pairs])).toBe("both");
  });

  it("says Pairs for teams of two and Team for three or more", () => {
    expect(ticketFormatLabel([solo])).toBe("Individual");
    expect(ticketFormatLabel([pairs])).toBe("Pairs");
    expect(ticketFormatLabel([squad])).toBe("Team");
    expect(ticketFormatLabel([trio, squad])).toBe("Team");
  });

  it("names every kind on offer when the tickets are mixed", () => {
    expect(ticketFormatLabel([solo, pairs])).toBe("Individual & Pairs");
    expect(ticketFormatLabel([pairs, squad])).toBe("Pairs & Team");
    expect(ticketFormatLabel([squad, solo, pairs])).toBe("Individual, Pairs & Team");
    expect(ticketFormatLabel([])).toBeNull();
  });

  it("writes the format into a payload that carries tickets, and leaves others alone", () => {
    expect(withTicketFormat({ format: "individual", waves: [pairs] }).format).toBe("team");
    expect(withTicketFormat({ format: "team", title: "Only a title" }).format).toBe("team");
  });

  it("shows the tickets' description on event pages, with the stored value as fallback", () => {
    expect(formatCompetitionFormat("individual", [solo, pairs])).toBe("Individual & Pairs");
    expect(formatCompetitionFormat("both")).toBe("Individual & Team");
  });
});
