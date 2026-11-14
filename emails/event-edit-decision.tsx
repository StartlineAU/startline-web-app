import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard } from './components/detail-card'
import { NoteBox } from './components/note-box'
import { CtaButton } from './components/cta-button'

export interface EventEditDecisionEmailProps {
  eventTitle: string
  approved: boolean
  reason?: string
  eventUrl: string
}

export function EventEditDecisionEmail({ eventTitle, approved, reason, eventUrl }: EventEditDecisionEmailProps) {
  return (
    <Shell
      preview={approved ? `Your changes to ${eventTitle} are live` : `Changes to ${eventTitle} were not approved`}
      label="Event update"
    >
      {approved ? (
        <Hero
          eyebrow="Changes approved"
          title="Changes live."
          sub="Startline approved your changes. They are now the live listing. The event was not taken off sale while they waited."
        />
      ) : (
        <Hero
          eyebrow="Changes not approved"
          tone="danger"
          title="No change made."
          sub="Startline did not approve your changes, so the live listing is unchanged."
        />
      )}
      <DetailCard eyebrow="Event" title={eventTitle} items={[]} />
      {!approved && reason && <NoteBox tone="danger" title="Reason" body={reason} />}
      <CtaButton href={eventUrl} label="Open the event" />
    </Shell>
  )
}

export default EventEditDecisionEmail
