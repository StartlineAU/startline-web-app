import { cn } from "@/lib/utils";
import type { LevelProgress } from "@/lib/user-level";

interface LevelBadgeProps {
  gamification: LevelProgress;
  compact?: boolean;
  className?: string;
}

export function LevelBadge({ gamification, compact = false, className }: LevelBadgeProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dark-lighter bg-dark/80",
        compact ? "px-4 py-3" : "px-5 py-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <p className="font-headline text-[10px] uppercase tracking-widest text-muted">
            Startline level
          </p>
          <p className="font-headline text-lg font-black italic tracking-tighter text-light">
            Lv {gamification.level}{" "}
            <span className="text-primary">{gamification.levelName}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-headline text-[10px] uppercase tracking-widest text-muted">
            Points
          </p>
          <p className="font-headline text-lg font-black text-light">
            {gamification.points.toLocaleString()}
          </p>
        </div>
      </div>

      {gamification.nextLevel !== null && gamification.pointsToNextLevel !== null ? (
        <>
          <div className="h-2 rounded-full bg-dark-lighter overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${gamification.progressPercent}%` }}
            />
          </div>
          <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-2">
            {gamification.pointsToNextLevel} pts to level {gamification.nextLevel}
          </p>
        </>
      ) : (
        <p className="font-headline text-[10px] uppercase tracking-widest text-primary mt-1">
          Max level reached
        </p>
      )}
    </div>
  );
}
