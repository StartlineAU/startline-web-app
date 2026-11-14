import { Link } from '@react-email/components'
import { colors, fonts, size, tableReset } from './tokens'

interface CtaButtonProps {
  href: string
  label: string
  /** Optional quiet link under the button, e.g. "Add to calendar". */
  secondary?: { href: string; label: string }
}

/**
 * The single primary action. A solid fill on the table cell, not a gradient,
 * so Outlook and Gmail still paint it; the link inside carries the same fill
 * so the whole face is clickable. Machined shadow (design.md §5) where the
 * client supports box-shadow; dark ink on green, always.
 */
export function CtaButton({ href, label, secondary }: CtaButtonProps) {
  return (
    <div className="sl-gutter" style={{ padding: '32px 40px 36px' }}>
      <table role="presentation" style={tableReset}>
        <tbody>
          <tr>
            <td
              align="center"
              style={{
                backgroundColor: colors.primary,
                borderRadius: '12px',
                boxShadow: `2px 2px 0 ${colors.primary}`,
              }}
            >
              <Link
                href={href}
                style={{
                  display: 'block',
                  padding: '16px 24px',
                  backgroundColor: colors.primary,
                  borderRadius: '12px',
                  color: colors.ink,
                  fontFamily: fonts.heading,
                  fontSize: size.body,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  textDecoration: 'none',
                  lineHeight: '1.2',
                }}
              >
                {label}
              </Link>
            </td>
          </tr>
          {secondary && (
            <tr>
              <td align="center" style={{ paddingTop: '16px' }}>
                <Link
                  href={secondary.href}
                  style={{
                    fontFamily: fonts.body,
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.primary,
                    textDecoration: 'none',
                  }}
                >
                  {secondary.label}
                </Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
