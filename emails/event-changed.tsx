import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { ChangeList, type ChangeLine } from './components/change-list'
import { Prose } from './components/prose'
import { CtaButton } from './components/cta-button'

export interface EventChangedEmailProps {
  greeting: string
  eventTitle: string
  organiserName: string
  changes: ChangeLine[]
  supportUrl: string
}

export function EventChangedEmail({ greeting, eventTitle, organiserName, changes, supportUrl }: EventChangedEmailProps) {
  return (
    <Shell preview={`${eventTitle} has changed`} label="Event update">
      <Hero eyebrow="Event changed" tone="warning" title="Details changed." />
      <Prose>{greeting}</Prose>
      <Prose>{`${organiserName} has changed the details of an event you entered:`}</Prose>
      <ChangeList title={eventTitle} changes={changes} />
      <Prose spaced>
        Your entry still stands and you don&apos;t need to do anything to keep it. If the new details
        don&apos;t work for you, ask for a refund through Support and Startline will review it with the
        organiser.
      </Prose>
      <CtaButton href={supportUrl} label="Ask for a refund" />
    </Shell>
  )
}

export default EventChangedEmail
