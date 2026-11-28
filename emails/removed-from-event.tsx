import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { Prose } from './components/prose'
import { DetailCard, type DetailItem } from './components/detail-card'
import { NoteBox } from './components/note-box'
import { CtaButton } from './components/cta-button'

export interface RemovedFromEventEmailProps {
  greeting: string
  eventTitle: string
  organiserName: string
  /** Human label of the organiser's reason, e.g. "Code of conduct". */
  reasonLabel: string
  /** The organiser's own words, only when they chose to share them. */
  note?: string | null
  /** Formatted refund amount, e.g. "$54.95", or null when nothing is refunded. */
  refundAmount: string | null
  /** True for a paid entry the organiser removed without a refund. */
  noRefund: boolean
  /** Whether the organisation has also blocked future entries. */
  blocked: boolean
  /** The team whose place was given to someone else, when it was. */
  replacedOnTeam?: string | null
  activityUrl: string
  supportUrl: string
}

export function RemovedFromEventEmail({
  greeting,
  eventTitle,
  organiserName,
  reasonLabel,
  note,
  refundAmount,
  noRefund,
  blocked,
  replacedOnTeam,
  activityUrl,
  supportUrl,
}: RemovedFromEventEmailProps) {
  const items: DetailItem[] = [{ label: 'Reason', value: reasonLabel }]
  if (note) items.push({ label: 'Note from the organiser', value: note, wide: true })
  if (refundAmount) items.push({ label: 'Refund', value: refundAmount })

  return (
    <Shell preview={`You've been removed from ${eventTitle}`} label="Entry update">
      <Hero eyebrow="Entry removed" tone="warning" title="Removed from event." />
      <Prose>{greeting}</Prose>
      <Prose>{`${organiserName} has removed your entry from ${eventTitle}. Your ticket no longer works and your place has been released.`}</Prose>
      <DetailCard eyebrow="Event" title={eventTitle} subtitle={organiserName} items={items} preWrap />
      {refundAmount && (
        <NoteBox
          tone="info"
          title="Refund on its way"
          body={`${refundAmount} is going back to your original payment method. Allow 5 to 10 business days.`}
        />
      )}
      {replacedOnTeam && (
        <NoteBox
          tone="info"
          title="Your place was passed on"
          body={`Your place on team ${replacedOnTeam} has been given to another member. The team's booking still covers it, so no refund is due.`}
        />
      )}
      {noRefund && (
        <NoteBox
          tone="warning"
          title="No refund"
          body="The organiser removed this entry for a breach of their code of conduct and has not refunded it. If you think that's wrong, contact Startline Support."
        />
      )}
      {blocked && (
        <NoteBox
          tone="warning"
          title="Future entries"
          body={`${organiserName} won't accept further entries from you. Contact the organiser with any questions.`}
        />
      )}
      <Prose spaced>Questions about this decision are best sent to the organiser.</Prose>
      <CtaButton href={activityUrl} label="View your activity" />
      <Prose spaced muted>{`Need help from Startline? ${supportUrl}`}</Prose>
    </Shell>
  )
}

export default RemovedFromEventEmail
