import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { CtaButton } from './components/cta-button'

export interface EventCancelledEmailProps {
  eventTitle: string
  eventDate: string | null
  /** Formatted dollars, e.g. "$54.95". Null for a free entry. */
  refundAmount: string | null
  reason: string | null
  activityUrl: string
}

/** To an athlete: the event is off, and anything they paid is coming back. A free entry is told only that it is released. */
export function EventCancelledEmail({
  eventTitle,
  eventDate,
  refundAmount,
  reason,
  activityUrl,
}: EventCancelledEmailProps) {
  const items: DetailItem[] = []
  if (eventDate) items.push({ label: 'Event date', value: eventDate })
  if (refundAmount) items.push({ label: 'Refund', value: `${refundAmount}, in full` })
  if (reason) items.push({ label: 'From the organiser', value: reason, wide: true })

  const sub = refundAmount
    ? `This event will not go ahead. You are being refunded everything you paid, ${refundAmount} including the booking fee, to your original payment method. Allow 5 to 10 business days for it to appear.`
    : 'This event will not go ahead, and your entry has been cancelled.'

  return (
    <Shell preview={`Cancelled: ${eventTitle}`} label="Event update">
      <Hero eyebrow="Event cancelled" tone="warning" title="Event cancelled." sub={sub} />
      <DetailCard eyebrow="Event" title={eventTitle} items={items} preWrap />
      <CtaButton href={activityUrl} label="View your entries" />
    </Shell>
  )
}

export default EventCancelledEmail
