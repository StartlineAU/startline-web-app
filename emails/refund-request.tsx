import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { CtaButton } from './components/cta-button'

export interface RefundRequestEmailProps {
  ticketId: string
  athleteName: string
  athleteEmail: string
  eventTitle: string
  eventDate: string | null
  reason: string
  eventUrl: string
}

export function RefundRequestEmail({
  ticketId,
  athleteName,
  athleteEmail,
  eventTitle,
  eventDate,
  reason,
  eventUrl,
}: RefundRequestEmailProps) {
  const items: DetailItem[] = [
    { label: 'Athlete', value: athleteName },
    { label: 'Email', value: athleteEmail },
  ]
  if (eventDate) items.push({ label: 'Event date', value: eventDate })
  items.push({ label: 'Ticket', value: ticketId })
  items.push({ label: 'Reason', value: reason, wide: true })

  return (
    <Shell preview={`Refund request: ${eventTitle}`} label="Support">
      <Hero
        eyebrow="Refund requested"
        tone="warning"
        title="Refund request."
        sub={`${athleteName} asked for a refund. Nothing has been issued yet.`}
      />
      <DetailCard eyebrow="Event" title={eventTitle} items={items} preWrap />
      <CtaButton href={eventUrl} label="Review the request" />
    </Shell>
  )
}

export default RefundRequestEmail
