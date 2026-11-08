import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { ChangeList, type ChangeLine } from './components/change-list'
import { CtaButton } from './components/cta-button'

export interface EventEditPendingReviewEmailProps {
  tag: string
  eventTitle: string
  organiserName: string
  changes: ChangeLine[]
  eventUrl: string
}

export function EventEditPendingReviewEmail({
  tag,
  eventTitle,
  organiserName,
  changes,
  eventUrl,
}: EventEditPendingReviewEmailProps) {
  return (
    <Shell preview={`${tag}Event edit to review: ${eventTitle}`} label="Admin">
      <Hero
        eyebrow={`${tag}Needs review`}
        tone="info"
        title="Edit to review."
        sub={`${organiserName} is not verified and edited this published event. The listing athletes see is unchanged until you approve it.`}
      />
      <ChangeList title={eventTitle} changes={changes} />
      <CtaButton href={eventUrl} label="Review the edit" />
    </Shell>
  )
}

export default EventEditPendingReviewEmail
