import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { Prose } from './components/prose'
import { DetailCard, type DetailItem } from './components/detail-card'
import { NoteBox } from './components/note-box'
import { CtaButton } from './components/cta-button'

/**
 * Where an athlete's refund request has got to (#492):
 * - requested: Startline has it and the organiser is deciding.
 * - refunded: approved and the money is on its way.
 * - approved: approved, but Startline is still issuing it.
 * - declined: the organiser said no, and why.
 */
export type RefundDecisionOutcome = 'requested' | 'refunded' | 'approved' | 'declined'

export interface RefundDecisionEmailProps {
  outcome: RefundDecisionOutcome
  greeting: string
  eventTitle: string
  organiserName: string
  /** Formatted amount: the refund issued, or the policy quote on a request. */
  amount: string | null
  /** True when everything paid comes back, booking fee included. */
  full: boolean
  /** The organiser's reason, already labelled. */
  reasonLabel?: string | null
  /** The organiser's note to the athlete. */
  note?: string | null
  /** When the organiser should decide by, already formatted. */
  respondBy?: string | null
  ticketRef: string
  activityUrl: string
  supportUrl: string
}

const COPY: Record<RefundDecisionOutcome, { eyebrow: string; title: string; preview: string }> = {
  requested: { eyebrow: 'Refund requested', title: 'Request received.', preview: 'We have your refund request for' },
  refunded: { eyebrow: 'Refund approved', title: 'Refund on its way.', preview: 'Your refund is on its way for' },
  approved: { eyebrow: 'Refund approved', title: 'Refund approved.', preview: 'Your refund was approved for' },
  declined: { eyebrow: 'Refund declined', title: 'Refund declined.', preview: 'Your refund request was declined for' },
}

export function RefundDecisionEmail({
  outcome,
  greeting,
  eventTitle,
  organiserName,
  amount,
  full,
  reasonLabel,
  note,
  respondBy,
  ticketRef,
  activityUrl,
  supportUrl,
}: RefundDecisionEmailProps) {
  const copy = COPY[outcome]
  const items: DetailItem[] = [{ label: 'Reference', value: ticketRef }]
  if (amount) {
    items.push({
      label: outcome === 'requested' ? 'Under the refund policy' : 'Refund',
      value: full ? `${amount}, booking fee included` : amount,
    })
  }
  if (reasonLabel) items.push({ label: 'Reason', value: reasonLabel })
  if (note) items.push({ label: 'Note from the organiser', value: note, wide: true })

  let body: string
  if (outcome === 'requested') {
    body = `${organiserName} decides on your request${respondBy ? `, usually by ${respondBy}` : ''}, and Startline issues the refund. Your place is held until then. If they decline, your entry stays as it is.`
  } else if (outcome === 'declined') {
    body = `${organiserName} has declined your refund request for ${eventTitle}. Your entry still stands and your place is held.`
  } else {
    body = `${organiserName} has approved your refund request for ${eventTitle}. Your entry has been cancelled and your place released.`
  }

  return (
    <Shell preview={`${copy.preview} ${eventTitle}`} label="Refund">
      <Hero
        eyebrow={copy.eyebrow}
        tone={outcome === 'declined' ? 'warning' : outcome === 'requested' ? 'info' : 'success'}
        title={copy.title}
      />
      <Prose>{greeting}</Prose>
      <Prose>{body}</Prose>
      <DetailCard eyebrow="Event" title={eventTitle} subtitle={organiserName} items={items} preWrap />
      {outcome === 'requested' && amount === '$0.00' && (
        <NoteBox
          tone="warning"
          title="Outside the refund policy"
          body="The organisation's refund policy does not cover a refund at this point. The organiser can still choose to refund you."
        />
      )}
      {outcome === 'refunded' && (
        <NoteBox
          tone="info"
          title="When it arrives"
          body="The refund goes back to your original payment method. Allow 5 to 10 business days."
        />
      )}
      {outcome === 'approved' && (
        <NoteBox
          tone="info"
          title="Being processed"
          body="Startline is issuing your refund to your original payment method and will email you once it has gone through."
        />
      )}
      {outcome === 'declined' && (
        <NoteBox
          tone="info"
          title="Your consumer rights"
          body="If the event is cancelled, not run, or changed so it is no longer what you paid for, you are still entitled to a refund under the Australian Consumer Law. Contact Startline Support if you think that applies."
        />
      )}
      <CtaButton href={activityUrl} label="View your activity" />
      <Prose spaced muted>{`Need help from Startline? ${supportUrl}`}</Prose>
    </Shell>
  )
}

export default RefundDecisionEmail
