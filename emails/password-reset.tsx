import { Section, Text } from '@react-email/components'
import { Shell } from './components/shell'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'
import { Badge } from './components/badge'
import { Headline } from './components/headline'
import { NoteBox } from './components/note-box'
import { CtaButton } from './components/cta-button'
import { colors, fonts } from './components/tokens'

export interface PasswordResetEmailProps {
  resetUrl: string
  expiryHours?: number
}

export function PasswordResetEmail({
  resetUrl,
  expiryHours = 24,
}: PasswordResetEmailProps) {
  return (
    <Shell preview="Reset your Startline password">
      <EmailHeader />

      <Section style={{ padding: '44px 44px 40px', textAlign: 'center' }}>
        <Badge type="security" />
        <Headline line1="Reset your" line2="password." />

        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: '15px',
            color: colors.muted,
            lineHeight: '1.65',
            margin: '0 0 32px',
          }}
        >
          Click the button below to set a new password for your Startline account.
        </Text>

        <CtaButton href={resetUrl} label="Reset Password" />

        <Section style={{ marginTop: '24px', textAlign: 'left' }}>
          <NoteBox
            icon="alert"
            title={`This link expires in ${expiryHours} hours`}
            body="For security, the password reset link is only valid for a limited time. Request a new one if it has expired."
          />
        </Section>
        <Section style={{ marginTop: '12px', textAlign: 'left' }}>
          <NoteBox
            icon="shield"
            title="Didn't request this?"
            body="If you didn't request a password reset, you can safely ignore this email. Your password will not change."
          />
        </Section>
      </Section>

      <EmailFooter />
    </Shell>
  )
}

export default PasswordResetEmail
