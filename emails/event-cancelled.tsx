import { Section, Text } from '@react-email/components'
import { Shell } from './components/shell'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'
import { Badge } from './components/badge'
import { Headline } from './components/headline'
import { NoteBox } from './components/note-box'
import { CtaButton } from './components/cta-button'
import { colors, fonts, SITE_URL } from './components/tokens'

export interface EventCancelledEmailProps {
  eventName: string
  eventDate: string
  location: string
  registrationRefund: string
  serviceFee: string
  refundTotal: string
}

export function EventCancelledEmail({
  eventName,
  eventDate,
  location,
  registrationRefund,
  serviceFee,
  refundTotal,
}: EventCancelledEmailProps) {
  return (
    <Shell preview={`${eventName} has been cancelled`}>
      <EmailHeader />

      {/* Hero band */}
      <Section
        style={{
          backgroundColor: 'rgba(248,113,113,0.07)',
          padding: '36px 44px',
          borderBottom: '1px solid rgba(248,113,113,0.2)',
          textAlign: 'center',
        }}
      >
        <Badge type="danger" />
        <Headline line1="Event" line2="Cancelled." line2Color="#F87171" />
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: '15px',
            color: colors.muted,
            lineHeight: '1.65',
            margin: '0',
          }}
        >
          We're sorry — this event has been cancelled by the organiser. Your refund is being processed.
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
                  {eventDate} · {location}
                </p>
              </td>
            </tr>

            {/* Refund breakdown header */}
            <tr>
              <td style={{ padding: '14px 22px 8px', borderTop: `1px solid ${colors.border}` }}>
                <p
                  style={{
                    margin: '0',
                    fontFamily: fonts.heading,
                    fontSize: '10px',
                    fontWeight: '700',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: '#F87171',
                  }}
                >
                  Refund Breakdown
                </p>
              </td>
            </tr>

            {/* Registration refund row */}
            <tr>
              <td style={{ padding: '10px 22px', borderTop: `1px solid ${colors.border}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.body,
                            fontSize: '14px',
                            color: colors.text,
                          }}
                        >
                          Registration refund
                        </p>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.body,
                            fontSize: '14px',
                            color: colors.text,
                          }}
                        >
                          {registrationRefund}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Service fee row */}
            <tr>
              <td style={{ padding: '10px 22px', borderTop: `1px solid ${colors.border}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.body,
                            fontSize: '13px',
                            color: colors.muted,
                          }}
                        >
                          Service fee (non-refundable)
                        </p>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.body,
                            fontSize: '13px',
                            color: colors.muted,
                          }}
                        >
                          — {serviceFee}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Total refund row */}
            <tr>
              <td
                style={{
                  padding: '13px 22px',
                  borderTop: `1px solid ${colors.border}`,
                  backgroundColor: colors.row,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.heading,
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            color: colors.muted,
                          }}
                        >
                          Refund Total
                        </p>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.heading,
                            fontSize: '22px',
                            fontWeight: '700',
                            fontStyle: 'italic',
                            color: colors.text,
                          }}
                        >
                          {refundTotal}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* CTA + note */}
      <Section style={{ padding: '24px 44px 16px', textAlign: 'center' }}>
        <CtaButton href={`${SITE_URL}/events`} label="Browse Other Events" />
      </Section>

      <Section style={{ padding: '0 44px 40px' }}>
        <NoteBox
          icon="alert"
          title="Refund timeline"
          body="Refunds are processed within 5–10 business days to your original payment method. Contact support@startline.com.au if you have questions."
        />
      </Section>

      <EmailFooter />
    </Shell>
  )
}

export default EventCancelledEmail
