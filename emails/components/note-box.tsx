import { Img } from '@react-email/components'
import { colors, fonts, size, SITE_URL, status, tableReset, type Tone } from './tokens'
import { iconUrl, type EmailIcon } from './icons'

const ICON: Record<Tone, EmailIcon> = {
  success: 'shield',
  info:    'clock',
  warning: 'alert',
  danger:  'alert-danger',
}

interface NoteBoxProps {
  tone: Tone
  title: string
  body: React.ReactNode
}

/** A callout in the well colour, its title in the status colour. */
export function NoteBox({ tone, title, body }: NoteBoxProps) {
  return (
    <div className="sl-gutter" style={{ padding: '20px 40px 0' }}>
      <table role="presentation" style={{ ...tableReset, backgroundColor: colors.well, borderRadius: '12px' }}>
        <tbody>
          <tr>
            <td style={{ padding: '18px 0 18px 20px', verticalAlign: 'top', width: '18px' }}>
              <Img src={iconUrl(ICON[tone], SITE_URL)} width="18" height="18" alt="" style={{ display: 'block' }} />
            </td>
            <td style={{ padding: '18px 20px 18px 12px', verticalAlign: 'top' }}>
              <p
                style={{
                  margin: '0 0 6px',
                  fontFamily: fonts.heading,
                  fontSize: size.label,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  lineHeight: '18px',
                  color: status[tone],
                }}
              >
                {title}
              </p>
              <p
                style={{
                  margin: '0',
                  fontFamily: fonts.body,
                  fontSize: size.body,
                  lineHeight: '1.6',
                  color: colors.text,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {body}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
