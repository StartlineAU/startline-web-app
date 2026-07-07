import { Img } from '@react-email/components'
import { colors, fonts, SITE_URL } from './tokens'

type NoteIcon = 'shield' | 'alert' | 'clock'

const ICON_FILE: Record<NoteIcon, string> = {
  shield: 'shield.svg',
  alert:  'alert.svg',
  clock:  'clock.svg',
}

interface NoteBoxProps {
  icon: NoteIcon
  title: string
  body: string
}

export function NoteBox({ icon, title, body }: NoteBoxProps) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        background: colors.well,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding: '15px 0 15px 20px', verticalAlign: 'top', width: '32px' }}>
            <Img
              src={`${SITE_URL}/email/icons/${ICON_FILE[icon]}`}
              width="16"
              height="16"
              alt=""
              style={{ display: 'block', marginTop: '2px' }}
            />
          </td>
          <td style={{ padding: '15px 20px 15px 8px', verticalAlign: 'top' }}>
            <p
              style={{
                margin: '0 0 4px',
                fontFamily: fonts.heading,
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: colors.text,
                lineHeight: '1',
              }}
            >
              {title}
            </p>
            <p
              style={{
                margin: '0',
                fontFamily: fonts.body,
                fontSize: '13px',
                color: colors.muted,
                lineHeight: '1.65',
              }}
            >
              {body}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
