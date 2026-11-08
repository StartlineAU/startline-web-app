import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard } from './components/detail-card'
import { CtaButton } from './components/cta-button'

export interface EventApprovedEmailProps {
  eventTitle: string
  dashboardUrl: string
}

export function EventApprovedEmail({ eventTitle, dashboardUrl }: EventApprovedEmailProps) {
  return (
    <Shell preview={`${eventTitle} is now live on Startline`} label="Event update">
      <Hero
        eyebrow="Event published"
        title="You're live."
        sub="Your event has been approved and athletes can find it on Startline now."
      />
      <DetailCard eyebrow="Event" title={eventTitle} items={[]} />
      <CtaButton href={dashboardUrl} label="View dashboard" />
    </Shell>
  )
}

export default EventApprovedEmail
