import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard } from './components/detail-card'
import { CtaButton } from './components/cta-button'

export interface ReviewReportedEmailProps {
  tag: string
  /** " (3 reports)" when reported more than once, otherwise empty. */
  count: string
  reviewTitle: string
  reviewerName: string
  about: string
  excerpt: string
  reason: string
  queueUrl: string
}

export function ReviewReportedEmail({
  tag,
  count,
  reviewTitle,
  reviewerName,
  about,
  excerpt,
  reason,
  queueUrl,
}: ReviewReportedEmailProps) {
  return (
    <Shell preview={`${tag}Review reported: ${reviewTitle}${count}`} label="Admin">
      <Hero
        eyebrow={`${tag}Review reported${count}`}
        tone="danger"
        title="Review flagged."
        sub="Someone reported this review. Check it against the review guidelines."
      />
      <DetailCard
        eyebrow="Review"
        title={reviewTitle}
        subtitle={about ? `By ${reviewerName} · ${about}` : `By ${reviewerName}`}
        preWrap
        items={[
          { label: 'Review', value: excerpt, wide: true },
          { label: 'Reason', value: reason, wide: true },
        ]}
      />
      <CtaButton href={queueUrl} label="Open reported reviews" />
    </Shell>
  )
}

export default ReviewReportedEmail
