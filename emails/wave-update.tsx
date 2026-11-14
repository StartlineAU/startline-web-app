import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { Prose } from './components/prose'
import { CtaButton } from './components/cta-button'

export interface WaveUpdateEmailProps {
  greeting: string
  eventTitle: string
  waveLabel: string
  waveTime?: string | null
  eventDate?: string | null
  activityUrl: string
  sentTo: string
}

export function WaveUpdateEmail({
  greeting,
  eventTitle,
  waveLabel,
  waveTime,
  eventDate,
  activityUrl,
  sentTo,
}: WaveUpdateEmailProps) {
  const items: DetailItem[] = [{ label: 'Start wave', value: waveLabel }]
  if (waveTime) items.push({ label: 'Start time', value: waveTime })
  if (eventDate) items.push({ label: 'Date', value: eventDate })

  return (
    <Shell preview={`Your start wave for ${eventTitle}`} label="Start wave" sentTo={sentTo}>
      <Hero eyebrow="Start wave update" title="Your start wave." />
      <Prose>{greeting}</Prose>
      <Prose>{`You're in the ${waveLabel} wave for ${eventTitle}.`}</Prose>
      <DetailCard eyebrow="Event" title={eventTitle} items={items} />
      <Prose spaced muted>
        Please arrive in good time for your wave. If anything changes, we&apos;ll let you know.
      </Prose>
      <CtaButton href={activityUrl} label="View your registration" />
    </Shell>
  )
}

export default WaveUpdateEmail
