import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { CtaButton } from './components/cta-button'

export interface RefundOverrideEmailProps {
  athleteName: string
  eventTitle: string
  /** What the organisation decided, or null when it had not responded. */
  organiserDecision: 'approved' | 'declined' | null
  /** What Startline decided instead. */
  decision: 'approved' | 'declined'
  note: string
  refundsUrl: string
}

/** Startline overrode the organisation's decision on a refund request (#570). */
export function RefundOverrideEmail({
  athleteName,
  eventTitle,
  organiserDecision,
  decision,
  note,
  refundsUrl,
}: RefundOverrideEmailProps) {
  const items: DetailItem[] = [
    { label: 'Athlete', value: athleteName },
    { label: 'Your decision', value: organiserDecision ?? 'Not yet decided' },
    { label: 'Startline decision', value: decision },
    { label: 'Reason', value: note, wide: true },
  ]

  return (
    <Shell preview={`Startline changed a refund decision: ${eventTitle}`} label="Support">
      <Hero
        eyebrow="Refund decision"
        tone="info"
        title="Refund decision changed."
        sub={`Startline ${decision} ${athleteName}'s refund request. You decide on refund requests, and Startline overrides that only as a recorded exception. The reason is below.`}
      />
      <DetailCard eyebrow="Event" title={eventTitle} items={items} preWrap />
      <CtaButton href={refundsUrl} label="View refund requests" />
    </Shell>
  )
}

export default RefundOverrideEmail
