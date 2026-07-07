import { Section, Row, Column, Text } from '@react-email/components'
import { Shell } from './components/shell'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'
import { Badge } from './components/badge'
import { Headline } from './components/headline'
import { NoteBox } from './components/note-box'
import { CtaButton } from './components/cta-button'
import { colors, fonts, SITE_URL } from './components/tokens'

export interface OtpVerificationEmailProps {
  otpCode: string
  expiryMinutes?: number
}

export function OtpVerificationEmail({
  otpCode = '123456',
  expiryMinutes = 10,
}: OtpVerificationEmailProps) {
  const digits = otpCode.split('')

  return (
    <Shell preview={`${otpCode} is your Startline verification code`}>
      <EmailHeader />

      <Section style={{ padding: '44px 44px 40px', textAlign: 'center' }}>
        <Badge type="security" />
        <Text
          style={{
            margin: '20px 0 6px',
            fontFamily: fonts.heading,
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: colors.primary,
          }}
        >
          Verify Your Account
        </Text>
        <Headline line1="Verify your" line2="email address." />
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: '15px',
            color: colors.muted,
            lineHeight: '1.65',
            margin: '0 0 32px',
          }}
        >
          Enter the code below to confirm your Startline account. It expires in {expiryMinutes} minutes.
        </Text>

        {/* OTP digit tiles */}
        <Section style={{ marginBottom: '32px' }}>
          <Row>
            {digits.map((digit, i) => (
              <Column key={i} style={{ width: '58px', padding: '0 4px', textAlign: 'center' }}>
                <div
                  style={{
                    display: 'inline-block',
                    width: '58px',
                    height: '74px',
                    lineHeight: '74px',
                    background: colors.deep,
                    border: `1.5px solid ${colors.primary}`,
                    borderRadius: '12px',
                    fontFamily: fonts.heading,
                    fontSize: '34px',
                    fontWeight: '700',
                    color: colors.primary,
                    textAlign: 'center',
                  }}
                >
                  {digit}
                </div>
              </Column>
            ))}
          </Row>
        </Section>

        <CtaButton href={`${SITE_URL}/verify-email`} label="Verify Email Address" />

        <Section style={{ marginTop: '32px', textAlign: 'left' }}>
          <NoteBox
            icon="shield"
            title="Didn't request this?"
            body="If you didn't create a Startline account, you can safely ignore this email. No action is required."
          />
        </Section>
      </Section>

      <EmailFooter />
    </Shell>
  )
}

export default OtpVerificationEmail
