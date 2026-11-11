import { Img } from '@react-email/components'
import { colors, fonts, size, SITE_URL, tableReset } from './tokens'

interface EmailHeaderProps {
  /** Right-aligned meta label, e.g. "Registration receipt". */
  label?: string
}

/**
 * Logo left, optional meta label right. The logo is a PNG: Gmail and Outlook
 * do not render SVG images, which is why the old header showed nothing there.
 */
export function EmailHeader({ label }: EmailHeaderProps) {
  return (
    <table role="presentation" style={tableReset}>
      <tbody>
        <tr>
          <td className="sl-gutter" style={{ padding: '28px 40px 8px', verticalAlign: 'middle' }}>
            <Img
              src={`${SITE_URL}/email/logo.png`}
              width="160"
              height="24"
              alt="Startline"
              style={{ display: 'block', border: '0', outline: 'none' }}
            />
          </td>
          {label && (
            <td
              className="sl-hide-sm"
              style={{
                padding: '28px 40px 8px 0',
                verticalAlign: 'middle',
                textAlign: 'right',
                fontFamily: fonts.heading,
                fontSize: size.label,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: colors.muted,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </td>
          )}
        </tr>
      </tbody>
    </table>
  )
}
