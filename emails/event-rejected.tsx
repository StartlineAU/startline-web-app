import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard } from './components/detail-card'
import { NoteBox } from './components/note-box'
import { Prose } from './components/prose'
import { CtaButton } from './components/cta-button'

export interface EventRejectedEmailProps {
  eventTitle: string
  reason?: string
  dashboardUrl: string
}

export function EventRejectedEmail({ eventTitle, reason, dashboardUrl }: EventRejectedEmailProps) {
  return (
    <Shell preview={`Update on your event ${eventTitle}`} label="Event update">
      <Hero
        eyebrow="Not approved"
        tone="danger"
        title="Changes needed."
        sub="Your event was not approved yet. Make the changes below and resubmit it."
      />
      <DetailCard eyebrow="Event" title={eventTitle} items={[]} />
      {reason && <NoteBox tone="danger" title="Reason" body={reason} />}
      <Prose spaced muted>
        Open your dashboard to edit the event, then submit it for review again.
      </Prose>
      <CtaButton href={dashboardUrl} label="Go to dashboard" />
    </Shell>
  )
}

export default EventRejectedEmail
