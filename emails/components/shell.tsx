import { Html, Head, Body, Container, Preview } from '@react-email/components'
import { colors } from './tokens'

interface ShellProps {
  preview: string
  children: React.ReactNode
}

export function Shell({ preview, children }: ShellProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="dark" />
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,700;1,700&family=Inter:wght@400;500&display=swap');`}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg, margin: '0', padding: '40px 0', fontFamily: "'Inter', Arial, sans-serif" }}>
        <Container
          style={{
            maxWidth: '600px',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
          }}
        >
          {children}
        </Container>
      </Body>
    </Html>
  )
}
