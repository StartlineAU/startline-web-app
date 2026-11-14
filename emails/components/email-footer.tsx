import { Link, Text } from '@react-email/components'
import { colors, fonts, size } from './tokens'
import { LEGAL_CONTACT_EMAIL } from '../../lib/legal'

interface EmailFooterProps {
  sentTo?: string
  sentToNote?: string
}

const prose: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: fonts.body,
  fontSize: size.sm,
  lineHeight: '1.6',
  color: colors.muted,
}

const social: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontSize: size.eyebrow,
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: colors.faint,
  textDecoration: 'none',
}

export function EmailFooter({ sentTo, sentToNote }: EmailFooterProps) {
  return (
    <div className="sl-gutter" style={{ padding: '24px 40px 32px', borderTop: `1px solid ${colors.border}` }}>
      {sentTo && (
        <Text style={prose}>
          This email was sent to{' '}
          <span style={{ color: colors.text, fontWeight: 500 }}>{sentTo}</span>.
          {sentToNote ? ` ${sentToNote}` : ''}
        </Text>
      )}
      <Text style={prose}>
        Questions?{' '}
        <Link href={`mailto:${LEGAL_CONTACT_EMAIL}`} style={{ color: colors.primary, textDecoration: 'none' }}>
          {LEGAL_CONTACT_EMAIL}
        </Link>
      </Text>
      <Text style={{ margin: '16px 0 0', fontSize: size.eyebrow, lineHeight: '1.6' }}>
        <Link href="https://www.instagram.com/startlineau" style={social}>Instagram</Link>
        <span style={{ color: colors.border, margin: '0 8px' }}>/</span>
        <Link href="https://www.facebook.com/startlineau" style={social}>Facebook</Link>
        <span style={{ color: colors.border, margin: '0 8px' }}>/</span>
        <Link href="https://www.strava.com/clubs/startlineau" style={social}>Strava</Link>
      </Text>
      <Text style={{ ...prose, margin: '12px 0 0', fontSize: size.meta, color: colors.faint }}>
        This is a transactional email about your Startline account or entry.
      </Text>
    </div>
  )
}
