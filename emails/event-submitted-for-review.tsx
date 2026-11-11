import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { NoteBox } from './components/note-box'
import { CtaButton } from './components/cta-button'

export interface EventSubmittedForReviewEmailProps {
  /** "[Staging] " on staging, otherwise empty. */
  tag: string
  eventTitle: string
  organiserName: string
  eventDate?: string | null
  location?: string | null
  discipline?: string | null
  blocker?: string | null
  previewUrl: string
  queueUrl: string
}

export function EventSubmittedForReviewEmail({
  tag,
  eventTitle,
  organiserName,
  eventDate,
  location,
  discipline,
  blocker,
  previewUrl,
  queueUrl,
}: EventSubmittedForReviewEmailProps) {
  const items: DetailItem[] = []
  if (eventDate) items.push({ label: 'Date', value: eventDate })
  if (discipline) items.push({ label: 'Discipline', value: discipline })
  if (location) items.push({ label: 'Location', value: location, wide: true })

  return (
    <Shell preview={`${tag}New event to review: ${eventTitle}`} label="Admin">
      <Hero
        eyebrow={`${tag}Needs review`}
        tone="info"
        title="New event to review."
        sub={`${organiserName} has listed a new event and it is waiting for approval.`}
      />
      <DetailCard eyebrow="Event" title={eventTitle} subtitle={organiserName} items={items} />
      {blocker && <NoteBox tone="warning" title="Approval blocked" body={`Cannot be approved yet: ${blocker}.`} />}
      <CtaButton
        href={previewUrl}
        label="Preview and review"
        secondary={{ href: queueUrl, label: 'Open the pending queue' }}
      />
    </Shell>
  )
}

export default EventSubmittedForReviewEmail
