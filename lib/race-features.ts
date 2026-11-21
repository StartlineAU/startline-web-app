// Start waves and bib numbers are opt-in per event (#566). Every surface that
// shows or writes either one asks here rather than reading the columns, so the
// "private until shared" promise holds in one place.
//
//   OFF      hidden everywhere; the data is kept, so turning it back on restores it
//   PRIVATE  the organiser can set it up; athletes see nothing
//   SHARED   athletes see their wave or bib

export const RACE_FEATURE_MODES = ["OFF", "PRIVATE", "SHARED"] as const;
export type RaceFeatureMode = (typeof RACE_FEATURE_MODES)[number];

export interface RaceFeatures {
  waveMode: RaceFeatureMode;
  bibMode: RaceFeatureMode;
}

export const RACE_FEATURES_SELECT = { waveMode: true, bibMode: true } as const;

type WaveFeature = Pick<RaceFeatures, "waveMode">;
type BibFeature = Pick<RaceFeatures, "bibMode">;

export const organiserSeesWaves = (e: WaveFeature) => e.waveMode !== "OFF";
export const organiserSeesBibs = (e: BibFeature) => e.bibMode !== "OFF";
export const athleteSeesWaves = (e: WaveFeature) => e.waveMode === "SHARED";
export const athleteSeesBibs = (e: BibFeature) => e.bibMode === "SHARED";

/** An athlete's start wave and bib, nulled unless the organiser has shared them. */
export function athleteRaceFields(
  event: RaceFeatures,
  reg: { startWaveLabel: string | null; bibNumber: string | null },
): { wave: string | null; bib: string | null } {
  return {
    wave: athleteSeesWaves(event) ? reg.startWaveLabel : null,
    bib: athleteSeesBibs(event) ? reg.bibNumber : null,
  };
}

/** Race day is ready once every feature that is on has been filled in. */
export function raceDayReady(
  event: RaceFeatures,
  counts: { total: number; withWave: number; withBib: number; wavesConfigured: number },
): boolean {
  if (counts.total === 0) return false;
  if (!organiserSeesWaves(event) && !organiserSeesBibs(event)) return false;
  const wavesDone = !organiserSeesWaves(event) || (counts.wavesConfigured > 0 && counts.withWave === counts.total);
  const bibsDone = !organiserSeesBibs(event) || counts.withBib === counts.total;
  return wavesDone && bibsDone;
}
