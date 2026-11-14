import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { Prose } from './components/prose'
import { CtaButton } from './components/cta-button'

export interface OrganiserInviteEmailProps {
  organisationName: string
  inviteUrl: string
  expiresInDays: number
}

// Sent when an Owner invites someone to help run their organisation. Nothing
// changes for the recipient unless they open the link and accept.
export function OrganiserInviteEmail({ organisationName, inviteUrl, expiresInDays }: OrganiserInviteEmailProps) {
  return (
    <Shell preview={`You're invited to help run ${organisationName} on Startline`}>
      <Hero
        eyebrow="Organiser invitation"
        title="You're invited"
        titleAccent="to join."
        sub={`${organisationName} has invited you to manage their events on Startline.`}
      />
      <Prose>
        Accept to become a manager of {organisationName}. You need to be signed in to Startline with
        this email address. The invitation expires in {expiresInDays} days.
      </Prose>
      <CtaButton href={inviteUrl} label="Review invitation" />
      <Prose>If you weren&apos;t expecting this, ignore this email. Nothing changes unless you accept.</Prose>
      <div style={{ height: '24px' }} />
    </Shell>
  )
}

export default OrganiserInviteEmail
