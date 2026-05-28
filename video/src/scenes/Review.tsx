import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, CLAMP } from '../lib/colors';
import { useSceneTransition, fadeUp, scaleIn, fadeIn } from '../lib/transition';
import { FONT_HEADLINE, FONT_BODY } from '../lib/fonts';

// ── Timeline item ─────────────────────────────────────────────────────────────
interface TimelineItemProps {
  text: string;
  sub: string;
  state: 'done' | 'active' | 'waiting';
  frame: number;
  fps: number;
  appearDelay: number;
  checkDelay: number;
  isLast?: boolean;
}

function TimelineItem({ text, sub, state, frame, fps, appearDelay, checkDelay, isLast }: TimelineItemProps) {
  const anim = fadeUp(frame, fps, appearDelay, 18);

  // Check mark pops in
  const checkSpring = scaleIn(frame, fps, checkDelay);
  const isDone  = frame >= checkDelay + 8;
  const isActiveNow = state === 'active' && !isDone;

  const dotBg   = isDone && state !== 'waiting' ? C.primary : isActiveNow ? '#3B82F6' : C.darkLighter;
  const textCol = isDone && state !== 'waiting' ? C.primary : state === 'active' ? C.light : C.muted;

  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        position: 'relative',
        paddingBottom: isLast ? 0 : 32,
        opacity: anim.opacity,
        transform: `translateY(${anim.translateY}px)`,
      }}
    >
      {/* Vertical line */}
      {!isLast && (
        <div
          style={{
            position: 'absolute',
            left: 17,
            top: 36,
            bottom: 0,
            width: 1,
            backgroundColor: C.darkLighter,
          }}
        />
      )}

      {/* Dot / check */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: dotBg,
          border: `2px solid ${isDone && state !== 'waiting' ? C.primary : isActiveNow ? '#3B82F6' : C.darkLighter}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          zIndex: 1,
          transform: `scale(${isDone && state !== 'waiting' ? checkSpring.scale : 1})`,
          opacity: isDone && state !== 'waiting' ? checkSpring.opacity : 1,
        }}
      >
        {isDone && state !== 'waiting' ? (
          <span style={{ fontSize: 18, lineHeight: 1 }}>✓</span>
        ) : isActiveNow ? (
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#3B82F6',
            }}
          />
        ) : null}
      </div>

      {/* Text */}
      <div>
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 15,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: textCol,
            marginBottom: 4,
          }}
        >
          {text}
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: C.mutedDark,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

// ── Email notification ────────────────────────────────────────────────────────
function EmailNotif({ frame, fps }: { frame: number; fps: number }) {
  const anim = fadeUp(frame, fps, 100, 22);
  return (
    <div
      style={{
        backgroundColor: C.dark,
        border: `1px solid ${C.darkLighter}`,
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 24,
        opacity: anim.opacity,
        transform: `translateY(${anim.translateY}px)`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 18px',
          backgroundColor: C.darkLight,
          borderBottom: `1px solid ${C.darkLighter}`,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: C.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          ✉
        </div>
        <div>
          <div
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 13,
              color: C.light,
            }}
          >
            Startline{' '}
            <span style={{ fontWeight: 400, color: C.muted, fontSize: 12 }}>
              hello@startlineau.com.au
            </span>
          </div>
          <div
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: C.muted,
            }}
          >
            Your event is approved and live!
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 18px' }}>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: C.muted,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 600, color: C.light }}>
            Ultra Trail Hobart 2026
          </span>{' '}
          is now live on Startline and visible to athletes across Australia. 🎉
        </p>
      </div>
    </div>
  );
}

// ── Main scene ────────────────────────────────────────────────────────────────
export const ReviewScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { translateX, opacity, scale } = useSceneTransition(frame, fps, durationInFrames);

  const tag  = fadeIn(frame, fps, 5);
  const h1a  = fadeUp(frame, fps, 12, 30);
  const h1b  = fadeUp(frame, fps, 20, 30);
  const sub  = fadeUp(frame, fps, 30, 18);
  const card = scaleIn(frame, fps, 20);

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
          background: `radial-gradient(ellipse 65% 75% at 30% 50%, rgba(179,225,83,0.07) 0%, transparent 65%)`,
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
          gridTemplateColumns: '1.1fr 1fr',
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
            }}
          >
            Step 03 — Submit for Review
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
              Submit for
            </div>
            <div
              style={{
                fontSize: 86,
                color: C.primary,
                opacity: h1b.opacity,
                transform: `translateY(${h1b.translateY}px)`,
              }}
            >
              review.
            </div>
          </div>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 18,
              color: C.muted,
              lineHeight: 1.6,
              maxWidth: 440,
              opacity: sub.opacity,
              transform: `translateY(${sub.translateY}px)`,
            }}
          >
            Our team reviews every event for accuracy and community
            standards. Usually within&nbsp;48&nbsp;hours.
          </p>

          {/* Feature bullets */}
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '⏱', text: 'Under 48-hour average review' },
              { icon: '✅', text: 'Accuracy & standards check'  },
              { icon: '📧', text: 'Email on approval'           },
              { icon: '✏️', text: 'Edit anytime before submit'  },
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

        {/* Right — timeline card */}
        <div style={{ opacity: card.opacity, transform: `scale(${card.scale})` }}>
          <div
            style={{
              backgroundColor: C.dark,
              border: `1px solid ${C.darkLighter}`,
              borderRadius: 20,
              padding: '32px 32px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 32,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_HEADLINE,
                  fontWeight: 700,
                  fontStyle: 'italic',
                  fontSize: 18,
                  letterSpacing: '-0.02em',
                  color: C.light,
                }}
              >
                Ultra Trail Hobart 2026
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 999,
                  padding: '5px 14px',
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#3B82F6' }} />
                <span
                  style={{
                    fontFamily: FONT_HEADLINE,
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    color: '#3B82F6',
                  }}
                >
                  Under Review
                </span>
              </div>
            </div>

            {/* Timeline */}
            <TimelineItem
              text="Listing submitted"
              sub="Today at 9:41 am"
              state="done"
              frame={frame}
              fps={fps}
              appearDelay={30}
              checkDelay={36}
            />
            <TimelineItem
              text="Details verified"
              sub="Today at 10:02 am"
              state="done"
              frame={frame}
              fps={fps}
              appearDelay={50}
              checkDelay={58}
            />
            <TimelineItem
              text="Community standards check"
              sub="In progress"
              state="active"
              frame={frame}
              fps={fps}
              appearDelay={68}
              checkDelay={200}
            />
            <TimelineItem
              text="Approved & published"
              sub="Pending"
              state="waiting"
              frame={frame}
              fps={fps}
              appearDelay={80}
              checkDelay={200}
              isLast
            />
          </div>

          {/* Email notification slides up below card */}
          <EmailNotif frame={frame} fps={fps} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
