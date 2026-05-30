import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, CLAMP } from '../lib/colors';
import { useSceneTransition, fadeUp, scaleIn, fadeIn } from '../lib/transition';
import { FONT_HEADLINE, FONT_BODY } from '../lib/fonts';

// ── Browser chrome ────────────────────────────────────────────────────────────
function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${C.darkLighter}`,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          backgroundColor: '#1a1a1a',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid ${C.darkLighter}`,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: c }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 320,
            margin: '0 auto',
            backgroundColor: C.dark,
            border: `1px solid ${C.darkLighter}`,
            borderRadius: 7,
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.3 }}>🔒</span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              color: C.muted,
            }}
          >
            startlineau.com.au/events
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Event card on athlete site ────────────────────────────────────────────────
interface EventCardProps {
  title: string;
  type: string;
  city: string;
  state: string;
  date: string;
  price: string;
  live?: boolean;
  frame: number;
  fps: number;
  delay: number;
}

function EventCard({ title, type, city, state, date, price, live, frame, fps, delay }: EventCardProps) {
  const anim = scaleIn(frame, fps, delay);

  // Live dot pulse: oscillates between 0.5 and 1 opacity
  const pulse = interpolate(
    (frame * 2) % 60,
    [0, 30, 60],
    [1, 0.4, 1],
    CLAMP,
  );

  return (
    <div
      style={{
        backgroundColor: '#1c1c1c',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 14,
        overflow: 'hidden',
        opacity: anim.opacity,
        transform: `scale(${anim.scale})`,
      }}
    >
      {/* Cover image area */}
      <div
        style={{
          aspectRatio: '16/9',
          background: `linear-gradient(135deg, #1a2a0a 0%, #0d1500 100%)`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          position: 'relative',
          padding: '10px',
        }}
      >
        {/* Type badge */}
        <span
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            backgroundColor: C.primary,
            color: C.darker,
            borderRadius: 5,
            padding: '3px 8px',
          }}
        >
          {type}
        </span>

        {/* Live badge */}
        {live && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'rgba(179,225,83,0.12)',
              border: `1px solid rgba(179,225,83,0.3)`,
              borderRadius: 999,
              padding: '3px 10px',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: C.primary,
                opacity: pulse,
              }}
            />
            <span
              style={{
                fontFamily: FONT_HEADLINE,
                fontWeight: 700,
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                color: C.primary,
              }}
            >
              Live
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '14px 14px' }}>
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontStyle: 'italic',
            fontSize: 16,
            letterSpacing: '-0.02em',
            color: C.light,
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.35)',
            marginBottom: 4,
          }}
        >
          📅 {date}
        </div>
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          📍 {city}, {state}
        </div>

        {/* Price row */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid rgba(255,255,255,0.06)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: 18,
              color: C.primary,
              letterSpacing: '-0.02em',
            }}
          >
            {price}
          </span>
          <span
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            Register →
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Nav bar mock ──────────────────────────────────────────────────────────────
function AthleteNav() {
  return (
    <div
      style={{
        backgroundColor: '#0a0a0a',
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
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
              fontSize: 15,
              color: C.darker,
              lineHeight: 1,
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
            fontSize: 14,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: C.light,
          }}
        >
          STARTLINE
        </span>
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        {['Events', 'By State', 'By Type', 'About'].map((l) => (
          <span
            key={l}
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.25)',
            }}
          >
            {l}
          </span>
        ))}
        <div
          style={{
            backgroundColor: 'rgba(179,225,83,0.1)',
            border: `1px solid rgba(179,225,83,0.25)`,
            borderRadius: 7,
            padding: '5px 14px',
          }}
        >
          <span
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: C.primary,
            }}
          >
            Sign In
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main scene ────────────────────────────────────────────────────────────────
export const GoLiveScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { translateX, opacity, scale } = useSceneTransition(frame, fps, durationInFrames);

  const tag    = fadeIn(frame, fps, 5);
  const h1a    = fadeUp(frame, fps, 12, 30);
  const h1b    = fadeUp(frame, fps, 20, 30);
  const sub    = fadeUp(frame, fps, 30, 18);
  const browser = scaleIn(frame, fps, 22);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.darker,
        transform: `translateX(${translateX}px) scale(${scale})`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 65% 60% at 75% 55%, rgba(179,225,83,0.08) 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: 1440,
          width: '100%',
          margin: '0 auto',
          padding: '0 80px',
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: 72,
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Left — text */}
        <div>
          <div
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.28em',
              color: C.primary,
              marginBottom: 20,
              opacity: tag.opacity,
            }}
          >
            Step 04 — Go Live
          </div>

          <div
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontStyle: 'italic',
              lineHeight: 0.88,
              letterSpacing: '-0.04em',
              marginBottom: 28,
            }}
          >
            <div
              style={{
                fontSize: 80,
                color: C.light,
                opacity: h1a.opacity,
                transform: `translateY(${h1a.translateY}px)`,
              }}
            >
              Watch it go
            </div>
            <div
              style={{
                fontSize: 80,
                color: C.light,
                opacity: h1a.opacity,
                transform: `translateY(${h1a.translateY}px)`,
              }}
            >
              live on
            </div>
            <div
              style={{
                fontSize: 80,
                color: C.primary,
                opacity: h1b.opacity,
                transform: `translateY(${h1b.translateY}px)`,
              }}
            >
              Startline.
            </div>
          </div>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 18,
              color: C.muted,
              lineHeight: 1.6,
              maxWidth: 380,
              opacity: sub.opacity,
              transform: `translateY(${sub.translateY}px)`,
            }}
          >
            Once approved, your event is instantly visible to thousands of
            athletes searching for their next race.
          </p>

          {/* Discovery callouts */}
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '🏠', text: 'Featured on homepage'      },
              { icon: '🔍', text: 'Search & filter by state'  },
              { icon: '🏆', text: 'Listed on discipline pages' },
            ].map(({ icon, text }, i) => {
              const fi = fadeUp(frame, fps, 38 + i * 10, 16);
              return (
                <div
                  key={text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    opacity: fi.opacity,
                    transform: `translateY(${fi.translateY}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: 'rgba(179,225,83,0.1)',
                      border: `1px solid rgba(179,225,83,0.2)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                  <span
                    style={{
                      fontFamily: FONT_HEADLINE,
                      fontWeight: 700,
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.16em',
                      color: C.muted,
                    }}
                  >
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — browser mockup */}
        <div
          style={{
            opacity: browser.opacity,
            transform: `scale(${browser.scale})`,
          }}
        >
          <BrowserChrome>
            <div style={{ backgroundColor: '#0f0f0f' }}>
              <AthleteNav />

              {/* Trending section header */}
              <div style={{ padding: '20px 28px 14px' }}>
                <div
                  style={{
                    fontFamily: FONT_HEADLINE,
                    fontWeight: 700,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.22em',
                    color: C.primary,
                    marginBottom: 6,
                  }}
                >
                  Trending Now
                </div>
                <div
                  style={{
                    fontFamily: FONT_HEADLINE,
                    fontWeight: 700,
                    fontStyle: 'italic',
                    fontSize: 22,
                    letterSpacing: '-0.03em',
                    color: C.light,
                  }}
                >
                  Most Popular Events
                </div>
              </div>

              {/* Event cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                  padding: '0 28px 24px',
                }}
              >
                <EventCard
                  title="Ultra Trail Hobart 2026"
                  type="Running"
                  city="Hobart"
                  state="TAS"
                  date="14 Mar 2026"
                  price="A$149"
                  live
                  frame={frame}
                  fps={fps}
                  delay={38}
                />
                <EventCard
                  title="Sydney Criterium Series"
                  type="Cycling"
                  city="Sydney"
                  state="NSW"
                  date="22 Mar 2026"
                  price="A$89"
                  frame={frame}
                  fps={fps}
                  delay={52}
                />
                <EventCard
                  title="CrossFit Open Melbourne"
                  type="CrossFit"
                  city="Melbourne"
                  state="VIC"
                  date="5 Apr 2026"
                  price="A$120"
                  frame={frame}
                  fps={fps}
                  delay={66}
                />
              </div>
            </div>
          </BrowserChrome>
        </div>
      </div>
    </AbsoluteFill>
  );
};
