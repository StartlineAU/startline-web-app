import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { Prose } from './components/prose'
import { CtaButton } from './components/cta-button'

export interface OrganiserClaimEmailProps {
  organisationName: string
  inviteUrl: string
  expiresInDays: number
}

// Sent when Startline has set up an organisation's profile on its behalf and
// invites the organiser to take it over as Owner. Nothing changes for the
// recipient unless they open the link and accept.
export function OrganiserClaimEmail({ organisationName, inviteUrl, expiresInDays }: OrganiserClaimEmailProps) {
  return (
    <Shell preview={`Claim ${organisationName} on Startline`}>
      <Hero
        eyebrow="Your organisation"
        title="Claim your"
        titleAccent="profile."
        sub={`Startline has set up a profile for ${organisationName} and listed its events.`}
      />
      <Prose>
        Accept to become the Owner of {organisationName}. You can then edit its events, see entries and
        set up payouts. You need to be signed in to Startline with this email address. The invitation
        expires in {expiresInDays} days.
      </Prose>
      <CtaButton href={inviteUrl} label="Claim organisation" />
      <Prose>If you weren&apos;t expecting this, ignore this email. Nothing changes unless you accept.</Prose>
      <div style={{ height: '24px' }} />
    </Shell>
  )
}

export default OrganiserClaimEmail
