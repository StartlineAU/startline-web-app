import { Section, Row, Column, Img } from '@react-email/components'
import { colors, SITE_URL } from './tokens'

export function EmailHeader() {
  return (
    <Section style={{ padding: '26px 44px 22px', borderBottom: `1px solid ${colors.border}` }}>
      <Row>
        <Column style={{ width: '32px' }}>
          <Img
            src={`${SITE_URL}/email/logo-mark.svg`}
            width="22"
            height="22"
            alt=""
            style={{ display: 'block' }}
          />
        </Column>
        <Column>
          <Img
            src={`${SITE_URL}/email/logo-title.svg`}
            height="13"
            alt="Startline"
            style={{ display: 'block' }}
          />
        </Column>
      </Row>
    </Section>
  )
}
