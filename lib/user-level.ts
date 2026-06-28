export const POINTS_PER_REGISTRATION = 100;

/** Minimum cumulative points required to reach each level (1-indexed). */
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000] as const;

export const LEVEL_NAMES: Record<number, string> = {
  1: "Newcomer",
  2: "Rookie",
  3: "Regular",
  4: "Active",
  5: "Dedicated",
  6: "Veteran",
  7: "Elite",
  8: "Champion",
  9: "Legend",
  10: "Icon",
};

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function levelFromPoints(points: number): number {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

export function levelName(level: number): string {
  return LEVEL_NAMES[level] ?? LEVEL_NAMES[MAX_LEVEL];
}

export interface LevelProgress {
  level: number;
  levelName: string;
  points: number;
  pointsInLevel: number;
  pointsToNextLevel: number | null;
  nextLevel: number | null;
  progressPercent: number;
}

export function getLevelProgress(points: number): LevelProgress {
  const level = levelFromPoints(points);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level] : null;
  const pointsInLevel = points - currentThreshold;
  const pointsToNextLevel =
    nextThreshold !== null ? Math.max(0, nextThreshold - points) : null;
  const bandSize =
    nextThreshold !== null ? nextThreshold - currentThreshold : 1;
  const progressPercent =
    nextThreshold !== null
      ? Math.min(100, Math.round((pointsInLevel / bandSize) * 100))
      : 100;

  return {
    level,
    levelName: levelName(level),
    points,
    pointsInLevel,
    pointsToNextLevel,
    nextLevel: nextThreshold !== null ? level + 1 : null,
    progressPercent,
  };
}
