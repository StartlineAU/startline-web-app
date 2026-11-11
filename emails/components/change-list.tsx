import { colors, fonts, labelStyle, size, tableReset } from './tokens'

export interface ChangeLine {
  label: string
  from: string
  to: string
}

interface ChangeListProps {
  title?: string
  changes: ChangeLine[]
}

/** Before and after for each changed field: old value struck, new value bold. */
export function ChangeList({ title, changes }: ChangeListProps) {
  return (
    <div className="sl-gutter" style={{ padding: '0 40px' }}>
      <table role="presentation" style={{ ...tableReset, backgroundColor: colors.well, borderRadius: '12px' }}>
        <tbody>
          {title && (
            <tr>
              <td style={{ padding: '24px 28px 4px' }}>
                <p
                  style={{
                    margin: '0',
                    fontFamily: fonts.heading,
                    fontSize: size.lg,
                    fontWeight: 700,
                    fontStyle: 'italic',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.2',
                    color: colors.text,
                  }}
                >
                  {title}
                </p>
              </td>
            </tr>
          )}
          {changes.map((c, i) => (
            <tr key={`${c.label}-${i}`}>
              <td
                style={{
                  padding: `${i === 0 && !title ? '24px' : '16px'} 28px ${i === changes.length - 1 ? '24px' : '0'}`,
                }}
              >
                <p style={{ ...labelStyle, marginBottom: '6px' }}>{c.label}</p>
                <p style={{ margin: '0', fontFamily: fonts.body, fontSize: size.sm, lineHeight: '1.5', color: colors.muted, textDecoration: 'line-through' }}>
                  {c.from}
                </p>
                <p style={{ margin: '2px 0 0', fontFamily: fonts.body, fontSize: size.md, fontWeight: 600, lineHeight: '1.45', color: colors.text }}>
                  {c.to}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
