import { Heading, Img, Text } from '@react-email/components'
import { colors, fonts, size, SITE_URL, status, tableReset, type Tone } from './tokens'
import { iconUrl, type EmailIcon } from './icons'

interface HeroProps {
  /** Two-word uppercase micro-label above the headline. */
  eyebrow: string
  /** Status tone of the eyebrow. Green unless the email is about a problem. */
  tone?: Tone
  /** Icon before the eyebrow. Defaults to a check for success, alert for danger. */
  icon?: EmailIcon | null
  title: string
  /** Optional second headline line, set in signal green. */
  titleAccent?: string
  sub?: React.ReactNode
}

const DEFAULT_ICON: Record<Tone, EmailIcon | null> = {
  success: 'check',
  info:    'clock',
  warning: 'alert',
  danger:  'alert-danger',
}

/** design.md §10 page anatomy: eyebrow, display headline, one muted sentence. */
export function Hero({ eyebrow, tone = 'success', icon, title, titleAccent, sub }: HeroProps) {
  const glyph = icon === undefined ? DEFAULT_ICON[tone] : icon
  return (
    <div className="sl-gutter" style={{ padding: '24px 40px 32px' }}>
      <table role="presentation" style={{ ...tableReset, width: 'auto' }}>
        <tbody>
          <tr>
            {glyph && (
              <td style={{ paddingRight: '8px', verticalAlign: 'middle', lineHeight: '0' }}>
                <Img src={iconUrl(glyph, SITE_URL)} width="18" height="18" alt="" style={{ display: 'block' }} />
              </td>
            )}
            <td
              style={{
                verticalAlign: 'middle',
                fontFamily: fonts.heading,
                fontSize: size.meta,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: status[tone],
              }}
            >
              {eyebrow}
            </td>
          </tr>
        </tbody>
      </table>

      <Heading
        as="h1"
        className="sl-h1"
        style={{
          margin: '16px 0 0',
          fontFamily: fonts.heading,
          fontSize: size['4xl'],
          fontWeight: 700,
          fontStyle: 'italic',
          letterSpacing: '-0.04em',
          lineHeight: '1',
          color: colors.text,
        }}
      >
        {title}
        {titleAccent && (
          <>
            <br />
            <span style={{ color: colors.primary }}>{titleAccent}</span>
          </>
        )}
      </Heading>

      {sub && (
        <Text
          style={{
            margin: '16px 0 0',
            fontFamily: fonts.body,
            fontSize: size.md,
            lineHeight: '1.55',
            color: colors.muted,
          }}
        >
          {sub}
        </Text>
      )}
    </div>
  )
}
