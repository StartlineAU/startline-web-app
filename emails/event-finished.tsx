import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard, type DetailItem } from './components/detail-card'
import { CtaButton } from './components/cta-button'

export interface EventFinishedEmailProps {
  eventTitle: string
  entries: number
  checkedIn: number
  withResults: number
  dashboardUrl: string
}

/** To the organisation: the race is over, here is how it went, now post results (#561). */
export function EventFinishedEmail({
  eventTitle,
  entries,
  checkedIn,
  withResults,
  dashboardUrl,
}: EventFinishedEmailProps) {
  const items: DetailItem[] = [{ label: 'Entered', value: String(entries) }]
  // Check-in is optional; a zero usually means it was not used.
  if (checkedIn > 0) items.push({ label: 'Checked in', value: String(checkedIn) })
  if (entries > 0) items.push({ label: 'Results posted', value: `${withResults} of ${entries}` })

  const resultsDone = entries > 0 && withResults >= entries
  const sub =
    entries === 0
      ? 'Your event has finished. Nobody was entered this time.'
      : resultsDone
        ? 'Your event has finished and every result is posted. Thanks for running it on Startline.'
        : 'Your event has finished. Post results and every athlete gets their time and placing on their Startline profile.'

  return (
    <Shell preview={`${eventTitle} has finished`} label="Event update">
      <Hero eyebrow="Event finished" title="That's a wrap." sub={sub} />
      <DetailCard eyebrow="Event" title={eventTitle} items={items} />
      <CtaButton
        href={dashboardUrl}
        label={entries > 0 && !resultsDone ? 'Enter results' : 'View dashboard'}
      />
    </Shell>
  )
}

export default EventFinishedEmail
