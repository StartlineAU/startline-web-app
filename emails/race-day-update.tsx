import { Section, Text } from '@react-email/components'
import { Shell } from './components/shell'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'
import { Badge } from './components/badge'
import { Headline } from './components/headline'
import { CtaButton } from './components/cta-button'
import { colors, fonts, SITE_URL } from './components/tokens'

export interface RaceDayUpdateEmailProps {
  eventName: string
  eventDate: string
  fieldChanged: string
  oldValue: string
  newValue: string
  organiserNote: string
}

export function RaceDayUpdateEmail({
  eventName,
  eventDate,
  fieldChanged,
  oldValue,
  newValue,
  organiserNote,
}: RaceDayUpdateEmailProps) {
  return (
    <Shell preview={`Important update for ${eventName}`}>
      <EmailHeader />

      <Section style={{ padding: '40px 44px 32px', textAlign: 'center' }}>
        <Badge type="warning" />
        <Headline line1="Race day" line2="update." line2Color="#FBBF24" />
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: '15px',
            color: colors.muted,
            lineHeight: '1.65',
            margin: '0',
          }}
        >
          An update has been made to an event you're registered for. Please review the details below.
        </Text>
      </Section>

      {/* Change card */}
      <Section style={{ padding: '0 44px 36px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
          }}
        >
          <tbody>
            {/* Card header */}
            <tr>
              <td
                style={{
                  backgroundColor: colors.row,
                  padding: '18px 22px',
                  borderRadius: '12px 12px 0 0',
                }}
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
                  {eventDate}
                </p>
              </td>
            </tr>

            {/* What changed label */}
            <tr>
              <td style={{ padding: '18px 22px 10px' }}>
                <p
                  style={{
                    margin: '0 0 14px',
                    fontFamily: fonts.heading,
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: '#FBBF24',
                  }}
                >
                  What Changed
                </p>

                {/* Field label */}
                <p
                  style={{
                    margin: '0 0 8px',
                    fontFamily: fonts.heading,
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: colors.muted,
                  }}
                >
                  {fieldChanged}
                </p>

                {/* Previous → Updated */}
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.heading,
                            fontSize: '15px',
                            color: colors.muted,
                            textDecoration: 'line-through',
                          }}
                        >
                          {oldValue}
                        </p>
                      </td>
                      <td
                        style={{
                          verticalAlign: 'middle',
                          paddingRight: '12px',
                          color: '#FBBF24',
                          fontFamily: fonts.heading,
                          fontSize: '18px',
                          fontWeight: '700',
                          width: '20px',
                        }}
                      >
                        →
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.heading,
                            fontSize: '18px',
                            fontWeight: '700',
                            color: colors.text,
                          }}
                        >
                          {newValue}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Organiser note */}
            <tr>
              <td style={{ padding: '0 22px 18px', borderTop: `1px solid ${colors.border}` }}>
                <p
                  style={{
                    margin: '14px 0 6px',
                    fontFamily: fonts.heading,
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: colors.muted,
                  }}
                >
                  Organiser Note
                </p>
                <p
                  style={{
                    margin: '0',
                    fontFamily: fonts.body,
                    fontSize: '14px',
                    color: colors.text,
                    lineHeight: '1.7',
                  }}
                >
                  {organiserNote}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={{ padding: '0 44px 40px', textAlign: 'center' }}>
        <CtaButton href={`${SITE_URL}/events`} label="View Event Details" />
      </Section>

      <EmailFooter />
    </Shell>
  )
}

export default RaceDayUpdateEmail
