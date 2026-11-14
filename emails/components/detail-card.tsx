import { colors, fonts, labelStyle, size, tableReset } from './tokens'

export interface DetailItem {
  label: string
  value: React.ReactNode
  /** Span both columns, for long values like a message or an address. */
  wide?: boolean
}

interface DetailCardProps {
  /** Small label above the title, e.g. "Event". */
  eyebrow?: string
  title?: string
  /** One line under the title, e.g. the organiser. */
  subtitle?: string
  items: DetailItem[]
  /** Keep line breaks in values (messages, review text). */
  preWrap?: boolean
}

/**
 * The nested well (design.md §2: surfaces step up as you nest): optional
 * title, then label/value pairs two to a row. Values wrap rather than truncate.
 */
export function DetailCard({ eyebrow, title, subtitle, items, preWrap }: DetailCardProps) {
  const rows: DetailItem[][] = []
  for (const item of items) {
    const last = rows[rows.length - 1]
    if (!item.wide && last && last.length === 1 && !last[0].wide) last.push(item)
    else rows.push([item])
  }
  const hasHead = Boolean(eyebrow || title || subtitle)

  return (
    <div className="sl-gutter" style={{ padding: '0 40px' }}>
      <table
        role="presentation"
        style={{ ...tableReset, backgroundColor: colors.well, borderRadius: '12px' }}
      >
        <tbody>
          {hasHead && (
            <tr>
              <td colSpan={2} style={{ padding: rows.length ? '28px 28px 0' : '24px 28px' }}>
                {eyebrow && <p style={{ ...labelStyle, marginBottom: '6px' }}>{eyebrow}</p>}
                {title && (
                  <p
                    style={{
                      margin: '0',
                      fontFamily: fonts.heading,
                      fontSize: size.xl,
                      fontWeight: 700,
                      fontStyle: 'italic',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.15',
                      color: colors.text,
                    }}
                  >
                    {title}
                  </p>
                )}
                {subtitle && (
                  <p style={{ margin: '6px 0 0', fontFamily: fonts.body, fontSize: size.sm, color: colors.muted }}>
                    {subtitle}
                  </p>
                )}
              </td>
            </tr>
          )}
          {hasHead && rows.length > 0 && (
            <tr>
              <td colSpan={2} style={{ padding: '24px 28px 0', fontSize: '0', lineHeight: '0' }}>
                <div style={{ borderTop: `1px solid ${colors.border}` }} />
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((item, j) => (
                <td
                  key={item.label}
                  colSpan={row.length === 1 ? 2 : 1}
                  style={{
                    width: row.length === 1 ? '100%' : '50%',
                    verticalAlign: 'top',
                    padding: `${i === 0 ? (hasHead ? '24px' : '28px') : '20px'} ${j === 0 && row.length > 1 ? '12px' : '28px'} ${i === rows.length - 1 ? '28px' : '0'} ${j === 1 ? '12px' : '28px'}`,
                  }}
                >
                  <p style={{ ...labelStyle, marginBottom: '6px' }}>{item.label}</p>
                  <p
                    style={{
                      margin: '0',
                      fontFamily: fonts.body,
                      fontSize: size.md,
                      fontWeight: 600,
                      lineHeight: '1.45',
                      color: colors.text,
                      whiteSpace: preWrap ? 'pre-wrap' : undefined,
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.value}
                  </p>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
