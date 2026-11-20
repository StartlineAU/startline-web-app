import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { Prose } from './components/prose'
import { CtaButton } from './components/cta-button'

export interface TeamDetailsNeededEmailProps {
  greeting: string
  eventTitle: string
  eventDate?: string | null
  /** Each team in the order with members still to name. */
  teams: { name: string; size: number; missing: number }[]
  activityUrl: string
  sentTo: string
}

/**
 * To the buyer of a team entry who left some members' details for later. The
 * places are paid for and held; the organiser still needs to know who is in
 * them, and the buyer adds that from Activity.
 */
export function TeamDetailsNeededEmail({
  greeting,
  eventTitle,
  eventDate,
  teams,
  activityUrl,
  sentTo,
}: TeamDetailsNeededEmailProps) {
  const missing = teams.reduce((sum, t) => sum + t.missing, 0)
  const items: DetailItem[] = teams.map((t) => ({
    label: t.name,
    value: `${t.missing} of ${t.size} still to add`,
  }))
  if (eventDate) items.push({ label: 'Date', value: eventDate })

  return (
    <Shell
      preview={`Add your team's details for ${eventTitle}`}
      label="Team details"
      sentTo={sentTo}
    >
      <Hero eyebrow="Action needed" title="Add your team's details." />
      <Prose>{greeting}</Prose>
      <Prose>
        {`Your team places for ${eventTitle} are booked and held. ${missing === 1 ? 'One member still needs' : `${missing} members still need`} their details added so the organiser knows who is racing.`}
      </Prose>
      <DetailCard eyebrow="Event" title={eventTitle} items={items} />
      <Prose spaced muted>
        Add them from your Activity page any time before race day. Each teammate gets their own
        confirmation email once their details are in.
      </Prose>
      <CtaButton href={activityUrl} label="Add team details" />
    </Shell>
  )
}

export default TeamDetailsNeededEmail
