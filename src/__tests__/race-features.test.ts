import { describe, it, expect } from "vitest";
import {
  athleteRaceFields,
  athleteSeesBibs,
  athleteSeesWaves,
  organiserSeesBibs,
  organiserSeesWaves,
  raceDayReady,
} from "@/lib/race-features";
import { assignSequentialBibs } from "@/lib/bib-assignment";

const reg = { startWaveLabel: "Wave A", bibNumber: "12" };

describe("race feature visibility (#566)", () => {
  it("hides both from organisers and athletes when off", () => {
    const e = { waveMode: "OFF", bibMode: "OFF" } as const;
    expect(organiserSeesWaves(e)).toBe(false);
    expect(organiserSeesBibs(e)).toBe(false);
    expect(athleteRaceFields(e, reg)).toEqual({ wave: null, bib: null });
  });

  it("shows organisers a private feature but never athletes", () => {
    const e = { waveMode: "PRIVATE", bibMode: "PRIVATE" } as const;
    expect(organiserSeesWaves(e)).toBe(true);
    expect(organiserSeesBibs(e)).toBe(true);
    expect(athleteSeesWaves(e)).toBe(false);
    expect(athleteSeesBibs(e)).toBe(false);
    expect(athleteRaceFields(e, reg)).toEqual({ wave: null, bib: null });
  });

  it("shows athletes only what has been shared", () => {
    expect(athleteRaceFields({ waveMode: "SHARED", bibMode: "PRIVATE" }, reg)).toEqual({ wave: "Wave A", bib: null });
    expect(athleteRaceFields({ waveMode: "OFF", bibMode: "SHARED" }, reg)).toEqual({ wave: null, bib: "12" });
  });
});

describe("raceDayReady", () => {
  const counts = { total: 10, withWave: 10, withBib: 10, wavesConfigured: 2 };

  it("is never ready with both features off: there is nothing to prepare", () => {
    expect(raceDayReady({ waveMode: "OFF", bibMode: "OFF" }, counts)).toBe(false);
  });

  it("only checks the features that are on", () => {
    const bibsOnly = { waveMode: "OFF", bibMode: "PRIVATE" } as const;
    expect(raceDayReady(bibsOnly, { ...counts, withWave: 0, wavesConfigured: 0 })).toBe(true);
    expect(raceDayReady(bibsOnly, { ...counts, withBib: 9 })).toBe(false);

    const wavesOnly = { waveMode: "SHARED", bibMode: "OFF" } as const;
    expect(raceDayReady(wavesOnly, { ...counts, withBib: 0 })).toBe(true);
    expect(raceDayReady(wavesOnly, { ...counts, withWave: 9 })).toBe(false);
    expect(raceDayReady(wavesOnly, { ...counts, wavesConfigured: 0 })).toBe(false);
  });

  it("is not ready with no athletes", () => {
    expect(raceDayReady({ waveMode: "SHARED", bibMode: "SHARED" }, { ...counts, total: 0 })).toBe(false);
  });
});

describe("bulk bib assignment ordering (#566)", () => {
  // Wave B sits above Wave A on the board, so it numbers first.
  const candidates = [
    { id: "1", name: "Zara", bibNumber: null, waveLabel: "Wave A", waveSort: 1 },
    { id: "2", name: "Amy", bibNumber: null, waveLabel: "Wave A", waveSort: 1 },
    { id: "3", name: "Yusuf", bibNumber: null, waveLabel: "Wave B", waveSort: 0 },
    { id: "4", name: "Ben", bibNumber: null, waveLabel: "Wave B", waveSort: 0 },
    { id: "5", name: "Aaron", bibNumber: null, waveLabel: null, waveSort: null },
    { id: "6", name: "Cleo", bibNumber: "2", waveLabel: "Wave B", waveSort: 0 },
  ];

  it("numbers wave by wave in board order, then by name, after the waves come athletes with none", () => {
    const result = assignSequentialBibs({ candidates, start: 1 });
    expect(result).toEqual([
      { registrationId: "4", bibNumber: "1" }, // Ben, Wave B
      { registrationId: "3", bibNumber: "3" }, // Yusuf, Wave B (2 is Cleo's)
      { registrationId: "2", bibNumber: "4" }, // Amy, Wave A
      { registrationId: "1", bibNumber: "5" }, // Zara, Wave A
      { registrationId: "5", bibNumber: "6" }, // Aaron, no wave
    ]);
  });

  it("never changes or reuses an existing bib", () => {
    const result = assignSequentialBibs({ candidates, start: 1, taken: new Set(["3", "4"]) });
    expect(result.find((a) => a.registrationId === "6")).toBeUndefined();
    const bibs = result.map((a) => a.bibNumber);
    expect(bibs).not.toContain("2");
    expect(bibs).not.toContain("3");
    expect(bibs).not.toContain("4");
    expect(new Set(bibs).size).toBe(bibs.length);
  });

  it("starts from a custom number", () => {
    const result = assignSequentialBibs({ candidates: candidates.slice(0, 2), start: 101 });
    expect(result.map((a) => a.bibNumber)).toEqual(["101", "102"]);
  });

  it("falls back to name order when there are no waves", () => {
    const result = assignSequentialBibs({
      candidates: [
        { id: "a", name: "Zoe", bibNumber: null, waveLabel: null },
        { id: "b", name: "alex", bibNumber: null, waveLabel: null },
      ],
      start: 1,
    });
    expect(result.map((a) => a.registrationId)).toEqual(["b", "a"]);
  });
});
