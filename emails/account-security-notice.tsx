import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { Prose } from './components/prose'

export interface AccountSecurityNoticeEmailProps {
  /** What changed, as a sentence: "Your sign-in email was changed to j***@example.com." */
  change: string
  supportEmail: string
}

// Sent to the account when something that controls access to it changes, so a
// change made with a stolen session does not go unnoticed by the owner.
export function AccountSecurityNoticeEmail({ change, supportEmail }: AccountSecurityNoticeEmailProps) {
  return (
    <Shell preview="A security change was made to your Startline account">
      <Hero
        eyebrow="Account security"
        title="Your account"
        titleAccent="changed."
        sub={change}
      />
      <Prose>If this was you, there is nothing else to do.</Prose>
      <Prose>
        If it was not you, reset your password straight away and email {supportEmail} so we can
        secure your account.
      </Prose>
      <div style={{ height: '24px' }} />
    </Shell>
  )
}

export default AccountSecurityNoticeEmail
