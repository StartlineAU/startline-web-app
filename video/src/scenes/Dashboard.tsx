import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, CLAMP } from '../lib/colors';
import { useSceneTransition, fadeUp, fadeIn, scaleIn, countUp } from '../lib/transition';
import { FONT_HEADLINE, FONT_BODY } from '../lib/fonts';

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: C.white,
        borderBottom: `1px solid ${C.gray200}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 36px',
        justifyContent: 'space-between',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: C.lime500,
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
              fontSize: 17,
              color: C.white,
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
            fontSize: 16,
            color: C.gray900,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          STARTLINE
        </span>
      </div>
      <div style={{ display: 'flex', gap: 28 }}>
        {['Dashboard', 'My Events', 'Profile', 'Help'].map((item, i) => (
          <span
            key={item}
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: i === 0 ? C.lime600 : C.gray400,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Mini stat card ────────────────────────────────────────────────────────────
interface MiniStatProps {
  label: string;
  value: number | string;
  sub: string;
  trend?: string;
  frame: number;
  fps: number;
  delay: number;
}

function MiniStat({ label, value, sub, trend, frame, fps, delay }: MiniStatProps) {
  const anim = scaleIn(frame, fps, delay);
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 14,
        padding: '28px 28px',
        opacity: anim.opacity,
        transform: `scale(${anim.scale})`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          fontFamily: FONT_HEADLINE,
          fontWeight: 700,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          color: C.gray900,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT_HEADLINE,
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: 56,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: C.gray900,
          marginBottom: 10,
        }}
      >
        {value}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.gray500 }}>{sub}</span>
        {trend && (
          <span
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: C.lime600,
            }}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────
interface EventRowProps {
  title: string;
  discipline: string;
  city: string;
  date: string;
  status: 'APPROVED' | 'PENDING' | 'DRAFT';
  reg: number;
  cap: number;
  frame: number;
  fps: number;
  delay: number;
  isLast?: boolean;
}

const STATUS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  APPROVED: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', label: 'Published'    },
  PENDING:  { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', label: 'Pending' },
  DRAFT:    { bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF', label: 'Draft'   },
};

function EventRow({ title, discipline, city, date, status, reg, cap, frame, fps, delay, isLast }: EventRowProps) {
  const s = STATUS[status];
  const anim = fadeUp(frame, fps, delay, 20);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '5fr 2fr 2fr 3fr',
        gap: 16,
        padding: '18px 24px',
        borderBottom: isLast ? 'none' : `1px solid ${C.gray100}`,
        alignItems: 'center',
        opacity: anim.opacity,
        transform: `translateY(${anim.translateY}px)`,
      }}
    >
      {/* Event */}
      <div>
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontStyle: 'italic',
            fontSize: 16,
            letterSpacing: '-0.02em',
            color: C.gray900,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            color: C.gray400,
            marginTop: 3,
          }}
        >
          📍 {city}
        </div>
      </div>

      {/* Date */}
      <div
        style={{
          fontFamily: FONT_HEADLINE,
          fontWeight: 700,
          fontSize: 14,
          color: C.gray900,
          textAlign: 'center',
        }}
      >
        {date}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: s.bg,
            color: s.text,
            borderRadius: 999,
            padding: '5px 14px',
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: s.dot,
            }}
          />
          <span
            style={{
              fontFamily: FONT_HEADLINE,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
            }}
          >
            {s.label}
          </span>
        </div>
      </div>

      {/* Registrations */}
      <div>
        <span
          style={{
            fontFamily: FONT_HEADLINE,
            fontWeight: 700,
            fontSize: 16,
            color: C.gray900,
          }}
        >
          {reg.toLocaleString()}
        </span>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: C.gray400,
          }}
        >
          {' '}/ {cap.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ── Main scene ────────────────────────────────────────────────────────────────
export const DashboardScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { translateX, opacity, scale } = useSceneTransition(frame, fps, durationInFrames);

  const tag  = fadeIn(frame, fps, 5);
  const h1a  = fadeUp(frame, fps, 12, 28);
  const h1b  = fadeUp(frame, fps, 20, 28);
  const sub  = fadeUp(frame, fps, 28, 20);

  const liveCount = countUp(frame, 3, 35, 70);
  const regCount  = countUp(frame, 147, 42, 72);
  const totCount  = countUp(frame, 5, 49, 74);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.gray50,
        transform: `translateX(${translateX}px) scale(${scale})`,
        opacity,
        overflow: 'hidden',
      }}
    >
      <TopBar />

      <div
        style={{
          paddingTop: 80,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            width: '100%',
            margin: '0 auto',
            padding: '48px 80px 32px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div
              style={{
                fontFamily: FONT_HEADLINE,
                fontWeight: 700,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.28em',
                color: C.lime600,
                marginBottom: 12,
                opacity: tag.opacity,
              }}
            >
              Welcome back
            </div>
            <div
              style={{
                fontFamily: FONT_HEADLINE,
                fontWeight: 700,
                fontStyle: 'italic',
                lineHeight: 0.88,
                letterSpacing: '-0.04em',
              }}
            >
              <div
                style={{
                  fontSize: 80,
                  color: C.gray900,
                  opacity: h1a.opacity,
                  transform: `translateY(${h1a.translateY}px)`,
                }}
              >
                Hi there.
              </div>
              <div
                style={{
                  fontSize: 80,
                  color: C.lime500,
                  opacity: h1b.opacity,
                  transform: `translateY(${h1b.translateY}px)`,
                }}
              >
                Here&apos;s your day.
              </div>
            </div>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 18,
                color: C.gray500,
                marginTop: 16,
                opacity: sub.opacity,
                transform: `translateY(${sub.translateY}px)`,
              }}
            >
              3 events live and taking registrations.
            </p>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 32 }}>
            <MiniStat label="Events live now"   value={liveCount}  sub={`of 5 total`}       trend="Taking sign-ups" frame={frame} fps={fps} delay={35} />
            <MiniStat label="Registrations"     value={regCount}   sub="across all events"  trend={regCount > 0 ? '↑ Growing' : undefined} frame={frame} fps={fps} delay={48} />
            <MiniStat label="Total events"      value={totCount}   sub="all time" frame={frame} fps={fps} delay={61} />
          </div>

          {/* Events table */}
          <div
            style={{
              backgroundColor: C.white,
              border: `1px solid ${C.gray200}`,
              borderRadius: 14,
              overflow: 'hidden',
              flex: 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '5fr 2fr 2fr 3fr',
                gap: 16,
                padding: '14px 24px',
                backgroundColor: C.gray50,
                borderBottom: `1px solid ${C.gray200}`,
              }}
            >
              {['Event', 'Date', 'Status', 'Registered / Cap'].map((h) => (
                <div
                  key={h}
                  style={{
                    fontFamily: FONT_HEADLINE,
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    color: C.gray900,
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            <EventRow
              title="Ultra Trail Hobart 2026"
              discipline="Running"
              city="Hobart, TAS"
              date="14 Mar"
              status="APPROVED"
              reg={83}
              cap={200}
              frame={frame}
              fps={fps}
              delay={72}
            />
            <EventRow
              title="Sydney Criterium Series"
              discipline="Cycling"
              city="Sydney, NSW"
              date="22 Mar"
              status="PENDING"
              reg={0}
              cap={150}
              frame={frame}
              fps={fps}
              delay={84}
            />
            <EventRow
              title="CrossFit Open Melbourne"
              discipline="CrossFit"
              city="Melbourne, VIC"
              date="5 Apr"
              status="DRAFT"
              reg={0}
              cap={100}
              frame={frame}
              fps={fps}
              delay={96}
              isLast
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
