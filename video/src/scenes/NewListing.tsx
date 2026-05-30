import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, CLAMP } from '../lib/colors';
import { useSceneTransition, fadeUp, scaleIn } from '../lib/transition';
import { FONT_HEADLINE, FONT_BODY } from '../lib/fonts';

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ frame }: { frame: number }) {
  // Slowly advances from step 1 → 5 across frame 40 to 115
  const step = interpolate(frame, [40, 115], [1, 5], CLAMP);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 999,
              backgroundColor: s <= Math.ceil(step) ? C.primary : C.darkLighter,
              transition: 'background-color 0.3s',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: C.muted,
          }}
        >
          Step {Math.min(Math.ceil(step), 5)} of 5
        </span>
        <span
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: C.primary,
          }}
        >
          {['', 'Event Details', 'Location', 'Tickets', 'Media', 'Review'][Math.min(Math.ceil(step), 5)]}
        </span>
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  frame,
  fps,
  delay,
  accent = false,
}: {
  label: string;
  value: string;
  frame: number;
  fps: number;
  delay: number;
  accent?: boolean;
}) {
  const anim = fadeUp(frame, fps, delay, 18);
  return (
    <div style={{ opacity: anim.opacity, transform: `translateY(${anim.translateY}px)` }}>
      <div
        style={{
          fontFamily: FONT_HEADLINE,
          fontWeight: 700,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: C.muted,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          backgroundColor: C.dark,
          border: `1px solid ${accent ? C.primary : C.darkLighter}`,
          borderRadius: 10,
          padding: '14px 16px',
          fontFamily: FONT_BODY,
          fontSize: 16,
          color: accent ? C.primary : C.light,
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Discipline pill ───────────────────────────────────────────────────────────
function DisciplinePill({ label, selected }: { label: string; selected: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '12px 16px',
        borderRadius: 10,
        textAlign: 'center',
        fontFamily: FONT_HEADLINE,
        fontWeight: 700,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        backgroundColor: selected ? 'rgba(179,225,83,0.12)' : C.dark,
        border: `1px solid ${selected ? C.primary : C.darkLighter}`,
        color: selected ? C.primary : C.muted,
      }}
    >
      {label}
    </div>
  );
}

// ── Main scene ────────────────────────────────────────────────────────────────
export const NewListingScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { translateX, opacity, scale } = useSceneTransition(frame, fps, durationInFrames);

  const tag   = fadeUp(frame, fps, 5, 20);
  const h1a   = fadeUp(frame, fps, 12, 30);
  const h1b   = fadeUp(frame, fps, 20, 30);
  const sub   = fadeUp(frame, fps, 28, 18);
  const card  = scaleIn(frame, fps, 22);

  // Highlight selected discipline using frame
  const step = interpolate(frame, [40, 115], [1, 5], CLAMP);
  const selectedDisc = Math.ceil(step) >= 2 ? 'Running' : '';

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
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 70% at 70% 50%, rgba(179,225,83,0.07) 0%, transparent 65%)`,
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
          gridTemplateColumns: '1fr 1.1fr',
          gap: 80,
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
              transform: `translateY(${tag.translateY}px)`,
            }}
          >
            Step 02 — Create a Listing
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
                fontSize: 86,
                color: C.light,
                opacity: h1a.opacity,
                transform: `translateY(${h1a.translateY}px)`,
              }}
            >
              Create your
            </div>
            <div
              style={{
                fontSize: 86,
                color: C.primary,
                opacity: h1b.opacity,
                transform: `translateY(${h1b.translateY}px)`,
              }}
            >
              event listing.
            </div>
          </div>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 18,
              color: C.muted,
              lineHeight: 1.6,
              maxWidth: 420,
              opacity: sub.opacity,
              transform: `translateY(${sub.translateY}px)`,
            }}
          >
            A guided five-step form — details, venue, tickets, media
            and review. Save a draft at any stage.
          </p>

          {/* Feature list */}
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '📅', text: 'Date, start time & venue' },
              { icon: '🎟', text: 'Multiple ticket waves & pricing' },
              { icon: '🗂', text: 'Disciplines & divisions' },
              { icon: '💾', text: 'Save draft anytime' },
            ].map(({ icon, text }, i) => {
              const fi = fadeUp(frame, fps, 36 + i * 10, 16);
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

        {/* Right — form card */}
        <div
          style={{
            backgroundColor: C.dark,
            border: `1px solid ${C.darkLighter}`,
            borderRadius: 20,
            overflow: 'hidden',
            opacity: card.opacity,
            transform: `scale(${card.scale})`,
            boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
          }}
        >
          {/* Progress header */}
          <div
            style={{
              padding: '24px 28px',
              borderBottom: `1px solid ${C.darkLighter}`,
              backgroundColor: C.darkLight,
            }}
          >
            <ProgressBar frame={frame} />
          </div>

          {/* Form body */}
          <div
            style={{
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <Field label="Event Title" value="Ultra Trail Hobart 2026" frame={frame} fps={fps} delay={48} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Date" value="📅  14 Mar 2026" frame={frame} fps={fps} delay={56} />
              <Field label="Location" value="📍  Hobart, TAS" frame={frame} fps={fps} delay={64} />
            </div>

            {/* Discipline */}
            {(() => {
              const da = fadeUp(frame, fps, 70, 16);
              return (
                <div style={{ opacity: da.opacity, transform: `translateY(${da.translateY}px)` }}>
                  <div
                    style={{
                      fontFamily: FONT_HEADLINE,
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.2em',
                      color: C.muted,
                      marginBottom: 10,
                    }}
                  >
                    Discipline
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['Running', 'CrossFit', 'Cycling'].map((d) => (
                      <DisciplinePill key={d} label={d} selected={selectedDisc === d} />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Ticket wave */}
            {(() => {
              const wa = fadeUp(frame, fps, 82, 18);
              return (
                <div
                  style={{
                    backgroundColor: C.darker,
                    border: `1px solid ${C.darkLighter}`,
                    borderRadius: 12,
                    padding: '18px 18px',
                    opacity: wa.opacity,
                    transform: `translateY(${wa.translateY}px)`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span
                      style={{
                        fontFamily: FONT_HEADLINE,
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        color: C.muted,
                      }}
                    >
                      Ticket Wave 1
                    </span>
                    <span
                      style={{
                        fontFamily: FONT_HEADLINE,
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.16em',
                        color: C.primary,
                        cursor: 'pointer',
                      }}
                    >
                      + Add Wave
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                    <div
                      style={{
                        backgroundColor: C.dark,
                        border: `1px solid ${C.darkLighter}`,
                        borderRadius: 8,
                        padding: '12px 14px',
                        fontFamily: FONT_BODY,
                        fontSize: 14,
                        color: C.muted,
                      }}
                    >
                      General Entry
                    </div>
                    <div
                      style={{
                        backgroundColor: C.dark,
                        border: `1px solid ${C.primary}`,
                        borderRadius: 8,
                        padding: '12px 14px',
                        fontFamily: FONT_HEADLINE,
                        fontWeight: 700,
                        fontSize: 15,
                        color: C.primary,
                        textAlign: 'center',
                      }}
                    >
                      A$149
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* CTA button */}
            {(() => {
              const ba = fadeUp(frame, fps, 95, 16);
              return (
                <div
                  style={{
                    backgroundColor: C.primary,
                    borderRadius: 12,
                    padding: '16px',
                    fontFamily: FONT_HEADLINE,
                    fontWeight: 700,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    color: C.darker,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: ba.opacity,
                    transform: `translateY(${ba.translateY}px)`,
                  }}
                >
                  Save &amp; Continue →
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
