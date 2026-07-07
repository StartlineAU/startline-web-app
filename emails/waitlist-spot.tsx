import { Section, Text } from '@react-email/components'
import { Shell } from './components/shell'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'
import { Badge } from './components/badge'
import { Headline } from './components/headline'
import { NoteBox } from './components/note-box'
import { CtaButton } from './components/cta-button'
import { colors, fonts, SITE_URL } from './components/tokens'

export interface WaitlistSpotEmailProps {
  eventName: string
  category: string
  eventDate: string
  entryFee: string
  location: string
  offerExpiryDatetime: string
  confirmUrl: string
}

const labelStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontFamily: "'Chakra Petch', Arial, sans-serif",
  fontSize: '10px',
  fontWeight: '700',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#8A8F98',
}

const valueStyle: React.CSSProperties = {
  margin: '0',
  fontFamily: "'Chakra Petch', Arial, sans-serif",
  fontSize: '15px',
  fontWeight: '700',
  color: '#F5F7FA',
}

export function WaitlistSpotEmail({
  eventName,
  category,
  eventDate,
  entryFee,
  location,
  offerExpiryDatetime,
  confirmUrl,
}: WaitlistSpotEmailProps) {
  return (
    <Shell preview={`Your spot for ${eventName} is ready — confirm within 48 hours`}>
      <EmailHeader />

      {/* Hero band */}
      <Section
        style={{
          backgroundColor: 'rgba(96,165,250,0.07)',
          padding: '36px 44px',
          borderBottom: '1px solid rgba(96,165,250,0.2)',
          textAlign: 'center',
        }}
      >
        <Badge type="info" />
        <Headline line1="Your spot" line2="is ready." line2Color="#60A5FA" />
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: '15px',
            color: colors.muted,
            lineHeight: '1.65',
            margin: '0',
          }}
        >
          A spot has opened up in {eventName}. You have{' '}
          <strong style={{ color: colors.text }}>48 hours</strong> to confirm your place before it
          is released to the next person on the waitlist.
        </Text>
      </Section>

      {/* Event card */}
      <Section style={{ padding: '32px 44px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
          }}
        >
          <tbody>
            {/* Header */}
            <tr>
              <td
                style={{
                  backgroundColor: colors.row,
                  padding: '18px 22px',
                  borderRadius: '12px 12px 0 0',
                }}
                colSpan={3}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontFamily: fonts.heading,
                    fontSize: '19px',
                    fontWeight: '700',
                    fontStyle: 'italic',
                    color: colors.text,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {eventName}
                </p>
                <p
                  style={{
                    margin: '0',
                    fontFamily: fonts.body,
                    fontSize: '13px',
                    color: colors.muted,
                  }}
                >
                  {category}
                </p>
              </td>
            </tr>

            {/* 3-column meta */}
            <tr>
              <td
                style={{
                  padding: '14px 22px',
                  borderTop: `1px solid ${colors.border}`,
                  borderRight: `1px solid ${colors.border}`,
                  width: '33.33%',
                }}
              >
                <p style={labelStyle}>Date</p>
                <p style={valueStyle}>{eventDate}</p>
              </td>
              <td
                style={{
                  padding: '14px 22px',
                  borderTop: `1px solid ${colors.border}`,
                  borderRight: `1px solid ${colors.border}`,
                  width: '33.33%',
                }}
              >
                <p style={labelStyle}>Entry Fee</p>
                <p style={valueStyle}>{entryFee}</p>
              </td>
              <td
                style={{
                  padding: '14px 22px',
                  borderTop: `1px solid ${colors.border}`,
                  width: '33.33%',
                }}
              >
                <p style={labelStyle}>Location</p>
                <p style={valueStyle}>{location}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Urgency note */}
      <Section style={{ padding: '20px 44px 0' }}>
        <NoteBox
          icon="clock"
          title="Spot expires soon"
          body={`This offer expires at ${offerExpiryDatetime}. If you don't confirm by then, your spot will be released to the next athlete on the waitlist.`}
        />
      </Section>

      {/* CTA */}
      <Section style={{ padding: '24px 44px 16px', textAlign: 'center' }}>
        <CtaButton href={confirmUrl} label="Confirm My Spot" />
      </Section>

      <Section style={{ padding: '0 44px 40px', textAlign: 'center' }}>
        <Text
          style={{
            margin: '0',
            fontFamily: fonts.body,
            fontSize: '13px',
            color: colors.muted,
          }}
        >
          No action needed to remain on the waitlist for other events.
        </Text>
      </Section>

      <EmailFooter />
    </Shell>
  )
}

export default WaitlistSpotEmail
