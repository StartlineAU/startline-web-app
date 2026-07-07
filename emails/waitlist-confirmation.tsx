import { Section, Text } from '@react-email/components'
import { Shell } from './components/shell'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'
import { Headline } from './components/headline'
import { colors, fonts } from './components/tokens'

export function WaitlistConfirmationEmail() {
  return (
    <Shell preview="You're on the Startline waitlist">
      <EmailHeader />
      <Section style={{ padding: '44px', textAlign: 'center' }}>
        <Headline line1="You're on" line2="the list." />
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: '15px',
            color: colors.muted,
            lineHeight: '1.65',
            margin: '0 0 16px',
          }}
        >
          Thanks for joining the Startline waitlist. We're building the best way to discover fitness
          racing, CrossFit, running and hybrid fitness events across Australia.
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: '15px',
            color: colors.muted,
            lineHeight: '1.65',
            margin: '0',
          }}
        >
          We'll let you know the moment we launch. Get ready to find your next start line.
        </Text>
      </Section>
      <EmailFooter />
    </Shell>
  )
}

export default WaitlistConfirmationEmail
