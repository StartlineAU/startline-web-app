import { BADGE_CONFIG, type BadgeType } from './tokens'

interface BadgeProps {
  type: BadgeType
}

export function Badge({ type }: BadgeProps) {
  const cfg = BADGE_CONFIG[type]
  return (
    <table
      style={{
        display: 'inline-table',
        borderCollapse: 'separate',
        borderSpacing: '0',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '100px',
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding: '5px 0 5px 10px', verticalAlign: 'middle', lineHeight: '1' }}>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: cfg.color,
              }}
            />
          </td>
          <td
            style={{
              padding: '5px 14px 5px 7px',
              verticalAlign: 'middle',
              fontFamily: "'Chakra Petch', Arial, sans-serif",
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: cfg.color,
              whiteSpace: 'nowrap',
              lineHeight: '1',
            }}
          >
            {cfg.label}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
