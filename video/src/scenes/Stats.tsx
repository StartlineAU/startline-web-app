import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../lib/colors';
import { useSceneTransition, fadeUp, fadeIn, countUp } from '../lib/transition';
import { FONT_HEADLINE, FONT_BODY } from '../lib/fonts';

interface StatCardProps {
  value: string;
  label: string;
  frame: number;
  fps: number;
  delay: number;
  countTarget?: number;
  countStart?: number;
  countEnd?: number;
  suffix?: string;
}

function StatCard({ value, label, frame, fps, delay, countTarget, countStart = 0, countEnd = 60, suffix = '' }: StatCardProps) {
  const anim = fadeUp(frame, fps, delay, 40);
  const displayValue = countTarget !== undefined
    ? countUp(frame, countTarget, countStart, countEnd) + suffix
    : value;

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: C.dark,
        border: `1px solid ${C.darkLighter}`,
        borderRadius: 20,
        padding: '56px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        opacity: anim.opacity,
        transform: `translateY(${anim.translateY}px)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle lime corner accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 80,
          height: 80,
          background: `radial-gradient(circle at 0% 0%, rgba(179,225,83,0.12) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          fontFamily: FONT_HEADLINE,
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: 96,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: C.primary,
        }}
      >
        {displayValue}
      </div>
      <div
        style={{
          fontFamily: FONT_HEADLINE,
          fontWeight: 700,
          fontSize: 15,
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          color: C.muted,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export const StatsScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { translateX, opacity, scale } = useSceneTransition(frame, fps, durationInFrames);
  const tag = fadeIn(frame, fps, 5);
  const h1  = fadeUp(frame, fps, 14, 30);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.darker,
        transform: `translateX(${translateX}px) scale(${scale})`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 50% at 50% 50%, rgba(179,225,83,0.06) 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 1440,
          padding: '0 80px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Label */}
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.28em',
            color: C.primary,
            marginBottom: 24,
            opacity: tag.opacity,
          }}
        >
          The Platform
        </div>

        {/* Headline */}
        <h2
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontStyle: 'italic',
            fontSize: 100,
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            color: C.light,
            marginBottom: 72,
            opacity: h1.opacity,
            transform: `translateY(${h1.translateY}px)`,
          }}
        >
          By the numbers.
        </h2>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 24 }}>
          <StatCard
            value="42K+"
            label="Athletes on platform"
            frame={frame}
            fps={fps}
            delay={28}
            countTarget={42}
            countStart={28}
            countEnd={80}
            suffix="K+"
          />
          <StatCard
            value="180+"
            label="Events listed"
            frame={frame}
            fps={fps}
            delay={42}
            countTarget={180}
            countStart={42}
            countEnd={88}
            suffix="+"
          />
          <StatCard
            value="8"
            label="States covered"
            frame={frame}
            fps={fps}
            delay={56}
            countTarget={8}
            countStart={56}
            countEnd={90}
          />
        </div>

        {/* Sub-copy */}
        <p
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 400,
            fontSize: 18,
            color: C.mutedDark,
            marginTop: 48,
            opacity: tag.opacity,
            letterSpacing: '0.01em',
          }}
        >
          Average review time under 48 hours · Free to list
        </p>
      </div>
    </AbsoluteFill>
  );
};
