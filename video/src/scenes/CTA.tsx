import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../lib/colors';
import { useSceneTransition, fadeUp, scaleIn, fadeIn } from '../lib/transition';
import { FONT_HEADLINE, FONT_BODY } from '../lib/fonts';

export const CTAScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // CTA is the last scene — entrance only, no exit
  const { translateX, opacity, scale } = useSceneTransition(frame, fps, durationInFrames + 100);

  const logo   = scaleIn(frame, fps, 0);
  const h1a    = fadeUp(frame, fps, 10, 36);
  const h1b    = fadeUp(frame, fps, 20, 36);
  const url    = fadeIn(frame, fps, 38);
  const div    = fadeIn(frame, fps, 50);
  const btn    = fadeUp(frame, fps, 58, 20);

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
      {/* Full-bleed lime glow — more intense for the final CTA */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 70% at 50% 50%, rgba(179,225,83,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 20% 80%, rgba(179,225,83,0.06) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 80% 20%, rgba(179,225,83,0.06) 0%, transparent 55%)
          `,
          pointerEvents: 'none',
        }}
      />

      {/* Scan grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(179,225,83,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(179,225,83,0.035) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      {/* Corner brackets — HUD style */}
      {[
        { top: 60, left: 80, borderLeft: true, borderTop: true },
        { top: 60, right: 80, borderRight: true, borderTop: true },
        { bottom: 60, left: 80, borderLeft: true, borderBottom: true },
        { bottom: 60, right: 80, borderRight: true, borderBottom: true },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 40,
            height: 40,
            opacity: logo.opacity * 0.4,
            ...Object.fromEntries(
              Object.entries(pos).map(([k, v]) =>
                k === 'borderLeft' ? ['borderLeft', `1px solid ${C.primary}`]
                : k === 'borderRight' ? ['borderRight', `1px solid ${C.primary}`]
                : k === 'borderTop' ? ['borderTop', `1px solid ${C.primary}`]
                : k === 'borderBottom' ? ['borderBottom', `1px solid ${C.primary}`]
                : [k, v]
              )
            ),
          }}
        />
      ))}

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          gap: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 56,
            opacity: logo.opacity,
            transform: `scale(${logo.scale})`,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
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
                fontSize: 32,
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
              fontSize: 34,
              color: C.light,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            STARTLINE
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontStyle: 'italic',
            lineHeight: 0.88,
            letterSpacing: '-0.04em',
            marginBottom: 48,
          }}
        >
          <div
            style={{
              fontSize: 140,
              color: C.light,
              opacity: h1a.opacity,
              transform: `translateY(${h1a.translateY}px)`,
            }}
          >
            Race day
          </div>
          <div
            style={{
              fontSize: 140,
              color: C.primary,
              opacity: h1b.opacity,
              transform: `translateY(${h1b.translateY}px)`,
            }}
          >
            starts here.
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 24,
            color: C.muted,
            letterSpacing: '0.04em',
            marginBottom: 40,
            opacity: url.opacity,
          }}
        >
          startlineau.com.au
        </div>

        {/* Divider */}
        <div
          style={{
            width: 280,
            height: 1,
            backgroundColor: C.darkLighter,
            marginBottom: 40,
            opacity: div.opacity,
          }}
        />

        {/* CTA button */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: C.primary,
            borderRadius: 14,
            padding: '20px 44px',
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: C.darker,
            opacity: btn.opacity,
            transform: `translateY(${btn.translateY}px)`,
          }}
        >
          Apply for an organiser account
          <span style={{ fontSize: 20, lineHeight: 1 }}>→</span>
        </div>

        {/* Fine print */}
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: C.mutedDark,
            marginTop: 20,
            opacity: btn.opacity,
          }}
        >
          Free to list · No upfront fees
        </div>
      </div>
    </AbsoluteFill>
  );
};
