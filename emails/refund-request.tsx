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
  /** The organiser decides; Startline is told so it can issue the refund. */
  audience: 'organiser' | 'admin'
  /** When the organiser's window to respond closes, already formatted. */
  respondBy: string
}

export function RefundRequestEmail({
  ticketId,
  athleteName,
  athleteEmail,
  eventTitle,
  eventDate,
  reason,
  eventUrl,
  audience,
  respondBy,
}: RefundRequestEmailProps) {
  const items: DetailItem[] = [
    { label: 'Athlete', value: athleteName },
    { label: 'Email', value: athleteEmail },
  ]
  if (eventDate) items.push({ label: 'Event date', value: eventDate })
  items.push({ label: 'Ticket', value: ticketId })
  items.push({ label: 'Respond by', value: respondBy })
  items.push({ label: 'Reason', value: reason, wide: true })

  const sub =
    audience === 'organiser'
      ? `${athleteName} asked for a refund. You decide on each request, and Startline issues the refund. Please respond by ${respondBy}.`
      : `${athleteName} asked for a refund. The organiser decides, and Startline issues the refund once it is approved. Startline can decide if the organiser has not responded by ${respondBy}.`

  return (
    <Shell preview={`Refund request: ${eventTitle}`} label="Support">
      <Hero eyebrow="Refund requested" tone="warning" title="Refund request." sub={sub} />
      <DetailCard eyebrow="Event" title={eventTitle} items={items} preWrap />
      <CtaButton href={eventUrl} label={audience === 'organiser' ? 'Decide on the request' : 'Open refund requests'} />
    </Shell>
  )
}

export default RefundRequestEmail
