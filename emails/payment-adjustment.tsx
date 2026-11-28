import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard } from './components/detail-card'
import { CtaButton } from './components/cta-button'
import type { Tone } from './components/tokens'

export interface PaymentAdjustmentEmailProps {
  tag: string
  /** "Refund issued in Stripe", "Card dispute opened", … */
  heading: string
  tone: Tone
  title: string
  sub: string
  eventTitle: string
  organiserName: string
  items: { label: string; value: string }[]
  payoutsUrl: string
}

/** Admin alert for a refund or dispute that happened in Stripe (#550). */
export function PaymentAdjustmentEmail({
  tag,
  heading,
  tone,
  title,
  sub,
  eventTitle,
  organiserName,
  items,
  payoutsUrl,
}: PaymentAdjustmentEmailProps) {
  return (
    <Shell preview={`${tag}${heading}: ${eventTitle}`} label="Admin">
      <Hero eyebrow={`${tag}${heading}`} tone={tone} title={title} sub={sub} />
      <DetailCard eyebrow="Event" title={eventTitle} subtitle={organiserName} items={items} />
      <CtaButton href={payoutsUrl} label="Open payouts" />
    </Shell>
  )
}

export default PaymentAdjustmentEmail
