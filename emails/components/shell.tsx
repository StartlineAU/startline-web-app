import { Html, Head, Body, Container, Preview, Section, Text } from '@react-email/components'
import { EmailHeader } from './email-header'
import { EmailFooter } from './email-footer'
import { colors, fonts, size, tableReset } from './tokens'
import { LEGAL_ENTITY_ABN, LEGAL_ENTITY_NAME } from '../../lib/legal'

interface ShellProps {
  /** Inbox preview line. */
  preview: string
  /** Right-hand meta label in the header, e.g. "Registration receipt". */
  label?: string
  /** Address this copy went to, shown in the footer. */
  sentTo?: string
  /** Sentence after the sent-to line, e.g. why to keep the email. */
  sentToNote?: string
  children: React.ReactNode
}

/**
 * The one layout every Startline email uses: a 600px raised card on the page
 * background, a 2px signal-green rule across the top, the logo header, then
 * the template's body and the shared footer. Legal line sits under the card.
 */
export function Shell({ preview, label, sentTo, sentToNote, children }: ShellProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        {/* Apple Mail and iOS load web fonts. Gmail and Outlook ignore this and use Arial. */}
        {/* An email document, not a Next page: the _document rule does not apply. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,700;1,700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Phones: tighter gutters, no header label. Inline styles stay the desktop
            values, so clients that drop <style> still get a working layout. */}
        <style>{`
          @media only screen and (max-width: 480px) {
            .sl-body { padding: 16px 8px !important; }
            .sl-gutter { padding-left: 20px !important; padding-right: 20px !important; }
            .sl-hide-sm { display: none !important; }
            .sl-h1 { font-size: 40px !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="sl-body"
        style={{
          backgroundColor: colors.bg,
          margin: '0',
          padding: '40px 16px',
          fontFamily: fonts.body,
          color: colors.text,
        }}
      >
        <Container style={{ maxWidth: '600px', width: '100%' }}>
          <table
            role="presentation"
            style={{
              ...tableReset,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    height: '2px',
                    lineHeight: '2px',
                    fontSize: '0',
                    backgroundColor: colors.primary,
                  }}
                >
                  &nbsp;
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0' }}>
                  <EmailHeader label={label} />
                  {children}
                  <EmailFooter sentTo={sentTo} sentToNote={sentToNote} />
                </td>
              </tr>
            </tbody>
          </table>

          <Section style={{ padding: '24px 0 0', textAlign: 'center' }}>
            <Text
              style={{
                margin: '0',
                fontFamily: fonts.body,
                fontSize: size.meta,
                lineHeight: '1.6',
                color: colors.faint,
              }}
            >
              {LEGAL_ENTITY_NAME} · ABN {LEGAL_ENTITY_ABN}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
