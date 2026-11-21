import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { SummaryTable } from './components/summary-table'
import { CtaButton } from './components/cta-button'
import { SITE_URL } from './components/tokens'

export interface RegistrationConfirmationEmailProps {
  eventId: string
  eventName: string
  eventSeries?: string
  /** Display-ready, e.g. "Sat, 21 Nov 2026". */
  eventDate: string
  /** Display-ready, e.g. "7:00 AM". */
  startTime: string
  category: string
  /** Display-ready, blanks already dropped. */
  location: string
  bib?: string
  /** Team entry, display-ready: "Harbour Hustlers (team of 4)". */
  team?: string
  registrationFee: string
  serviceFee: string
  total: string
  userEmail: string
  /** "Add to calendar" link, when the event has a start instant. */
  calendarUrl?: string | null
}

export function RegistrationConfirmationEmail({
  eventId,
  eventName,
  eventSeries,
  eventDate,
  startTime,
  category,
  location,
  bib,
  team,
  registrationFee,
  serviceFee,
  total,
  userEmail,
  calendarUrl,
}: RegistrationConfirmationEmailProps) {
  const details: DetailItem[] = [
    { label: 'Date', value: eventDate },
    { label: 'Start time', value: startTime },
    { label: 'Category', value: category },
    ...(team ? [{ label: 'Team', value: team }] : []),
    { label: 'Location', value: location || 'To be confirmed' },
  ]
  if (bib) details.push({ label: 'Bib number', value: `#${bib}` })

  return (
    <Shell
      preview={`You're registered for ${eventName}`}
      label="Registration receipt"
      sentTo={userEmail}
      sentToNote="Keep it handy, you may need it at check-in."
    >
      <Hero
        eyebrow="Registration confirmed"
        title="You're in."
        sub="Your spot is locked in. Here's everything you need for race day."
      />

      <DetailCard eyebrow="Event" title={eventName} subtitle={eventSeries} items={details} />

      <SummaryTable
        title="Payment summary"
        rows={[
          { label: team ? 'Your entry' : 'Registration', value: registrationFee },
          { label: 'Service fee', value: serviceFee },
        ]}
        total={{ label: 'Total paid', value: total }}
      />

      <CtaButton
        href={`${SITE_URL}/events/${encodeURIComponent(eventId)}`}
        label="View event details"
        secondary={calendarUrl ? { href: calendarUrl, label: 'Add to calendar' } : undefined}
      />
    </Shell>
  )
}

export default RegistrationConfirmationEmail
