import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'

export interface FeedbackSubmittedEmailProps {
  reference: string
  type: string
  title: string
  details: string
  email?: string
  filenames?: string[]
}

/** Internal: a bug report or suggestion from the feedback form. */
export function FeedbackSubmittedEmail({ reference, type, title, details, email, filenames }: FeedbackSubmittedEmailProps) {
  const items: DetailItem[] = [{ label: 'Type', value: type }]
  if (email) items.push({ label: 'From', value: email })
  items.push({ label: 'Details', value: details, wide: true })
  if (filenames?.length) items.push({ label: 'Attachments', value: filenames.join(', '), wide: true })

  return (
    <Shell preview={`[${type}] ${title}`} label={`Ref ${reference}`}>
      <Hero eyebrow="Startline feedback" tone="info" icon={null} title="New report." />
      <DetailCard eyebrow={`Ref ${reference}`} title={title} items={items} preWrap />
      <div style={{ height: '36px' }} />
    </Shell>
  )
}

export default FeedbackSubmittedEmail
