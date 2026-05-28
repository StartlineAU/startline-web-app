import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../lib/colors';
import { useSceneTransition, fadeUp, scaleIn, fadeIn } from '../lib/transition';
import { FONT_HEADLINE, FONT_BODY } from '../lib/fonts';

export const IntroScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { translateX, opacity, scale } = useSceneTransition(frame, fps, durationInFrames);

  const logo   = scaleIn(frame, fps, 0);
  const tag    = fadeIn(frame, fps, 8);
  const h1a    = fadeUp(frame, fps, 14, 32);
  const h1b    = fadeUp(frame, fps, 22, 32);
  const sub    = fadeUp(frame, fps, 32, 20);
  const pill1  = scaleIn(frame, fps, 44);
  const pill2  = scaleIn(frame, fps, 52);
  const pill3  = scaleIn(frame, fps, 60);
  const pill4  = scaleIn(frame, fps, 68);

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
      {/* Radial lime glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 50% 45%, rgba(179,225,83,0.09) 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Scan-grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(179,225,83,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(179,225,83,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo mark + wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 40,
            transform: `scale(${logo.scale})`,
            opacity: logo.opacity,
          }}
        >
          {/* Geometric mark */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              backgroundColor: C.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: FONT_HEADLINE,
                fontWeight: 700,
                fontStyle: 'italic',
                fontSize: 28,
                color: C.darker,
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              S
            </span>
          </div>
          <span
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: 32,
              color: C.light,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            STARTLINE
          </span>
        </div>

        {/* Tag label */}
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.28em',
            color: C.primary,
            marginBottom: 28,
            opacity: tag.opacity,
          }}
        >
          Australia's Competitive Fitness Calendar
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontStyle: 'italic',
            lineHeight: 0.88,
            letterSpacing: '-0.03em',
            color: C.light,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              fontSize: 128,
              opacity: h1a.opacity,
              transform: `translateY(${h1a.translateY}px)`,
            }}
          >
            Race day
          </div>
          <div
            style={{
              fontSize: 128,
              color: C.primary,
              opacity: h1b.opacity,
              transform: `translateY(${h1b.translateY}px)`,
            }}
          >
            starts here.
          </div>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 400,
            fontSize: 22,
            color: C.muted,
            lineHeight: 1.55,
            maxWidth: 520,
            marginBottom: 52,
            opacity: sub.opacity,
            transform: `translateY(${sub.translateY}px)`,
          }}
        >
          Publish events, reach thousands of athletes, and&nbsp;manage
          everything from one organiser portal.
        </p>

        {/* Discipline pills */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'CrossFit',  delay: pill1 },
            { label: 'Running',   delay: pill2 },
            { label: 'Cycling',   delay: pill3 },
            { label: 'Swimming',  delay: pill4 },
          ].map(({ label, delay }) => (
            <div
              key={label}
              style={{
                fontFamily: FONT_HEADLINE,
                fontWeight: 700,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: C.muted,
                border: `1px solid ${C.darkLighter}`,
                borderRadius: 999,
                padding: '10px 20px',
                opacity: delay.opacity,
                transform: `scale(${delay.scale})`,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
