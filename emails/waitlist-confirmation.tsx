import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { Prose } from './components/prose'

export function WaitlistConfirmationEmail() {
  return (
    <Shell preview="You're on the Startline waitlist">
      <Hero
        eyebrow="Waitlist"
        title="You're on"
        titleAccent="the list."
        sub="Thanks for joining the Startline waitlist."
      />
      <Prose>
        We&apos;re building the best way to discover fitness racing, CrossFit, running and hybrid
        fitness events across Australia.
      </Prose>
      <Prose>We&apos;ll let you know the moment we launch. Get ready to find your next start line.</Prose>
      <div style={{ height: '24px' }} />
    </Shell>
  )
}

export default WaitlistConfirmationEmail
