import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { Prose } from './components/prose'
import { CtaButton } from './components/cta-button'

export interface FollowedOrganiserEventEmailProps {
  greeting: string
  organiserName: string
  eventTitle: string
  eventDate?: string | null
  city?: string | null
  eventUrl: string
  sentTo: string
}

export function FollowedOrganiserEventEmail({
  greeting,
  organiserName,
  eventTitle,
  eventDate,
  city,
  eventUrl,
  sentTo,
}: FollowedOrganiserEventEmailProps) {
  const items: DetailItem[] = []
  if (eventDate) items.push({ label: 'Date', value: eventDate })
  if (city) items.push({ label: 'Location', value: city })

  return (
    <Shell preview={`${organiserName} posted ${eventTitle}`} label="New event" sentTo={sentTo}>
      <Hero eyebrow="New event" title="Just announced." sub={`${organiserName} just went live with a new event.`} />
      <Prose>{greeting}</Prose>
      <Prose>{`${organiserName}, an organiser you follow, posted ${eventTitle}.`}</Prose>
      <DetailCard eyebrow="Event" title={eventTitle} subtitle={organiserName} items={items} />
      <CtaButton href={eventUrl} label="View event" />
    </Shell>
  )
}

export default FollowedOrganiserEventEmail
