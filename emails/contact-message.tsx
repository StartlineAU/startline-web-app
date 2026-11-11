import { Shell } from './components/shell'
import { Hero } from './components/hero'
import { DetailCard } from './components/detail-card'
import { CtaButton } from './components/cta-button'

export interface ContactMessageEmailProps {
  name: string
  email: string
  subject: string
  message: string
}

/** Internal: a contact form message to the Startline inbox. */
export function ContactMessageEmail({ name, email, subject, message }: ContactMessageEmailProps) {
  return (
    <Shell preview={`[Contact] ${subject}`} label="Contact form">
      <Hero eyebrow="Contact form" tone="info" icon={null} title="New message." sub={`From ${name}.`} />
      <DetailCard
        eyebrow="Subject"
        title={subject}
        preWrap
        items={[
          { label: 'Name', value: name },
          { label: 'Email', value: email },
          { label: 'Message', value: message, wide: true },
        ]}
      />
      <CtaButton href={`mailto:${email}`} label="Reply" />
    </Shell>
  )
}

export default ContactMessageEmail
