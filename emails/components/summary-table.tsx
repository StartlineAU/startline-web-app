import { colors, fonts, labelStyle, size, tableReset } from './tokens'

interface SummaryTableProps {
  title: string
  rows: { label: string; value: string }[]
  total: { label: string; value: string }
}

/** Hairline-ruled line items, then the total as the big italic number. */
export function SummaryTable({ title, rows, total }: SummaryTableProps) {
  const cell: React.CSSProperties = {
    padding: '12px 0',
    borderTop: `1px solid ${colors.border}`,
    fontFamily: fonts.body,
    fontSize: '14px',
    lineHeight: '1.4',
  }
  return (
    <div className="sl-gutter" style={{ padding: '32px 40px 0' }}>
      <p style={{ ...labelStyle, paddingBottom: '12px' }}>{title}</p>
      <table role="presentation" style={tableReset}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td style={{ ...cell, color: colors.soft }}>{row.label}</td>
              <td style={{ ...cell, color: colors.text, textAlign: 'right' }}>{row.value}</td>
            </tr>
          ))}
          <tr>
            <td
              style={{
                padding: '16px 0 0',
                borderTop: `1px solid ${colors.faint}`,
                fontFamily: fonts.body,
                fontSize: '14px',
                fontWeight: 600,
                color: colors.text,
                verticalAlign: 'bottom',
              }}
            >
              {total.label}
            </td>
            <td
              style={{
                padding: '16px 0 0',
                borderTop: `1px solid ${colors.faint}`,
                textAlign: 'right',
                fontFamily: fonts.heading,
                fontSize: size['2xl'],
                fontWeight: 700,
                fontStyle: 'italic',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                color: colors.text,
              }}
            >
              {total.value}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
