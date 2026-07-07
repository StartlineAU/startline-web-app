import { Heading } from '@react-email/components'
import { colors, fonts } from './tokens'

interface HeadlineProps {
  line1: string
  line2?: string
  line2Color?: string
}

export function Headline({ line1, line2, line2Color = colors.primary }: HeadlineProps) {
  return (
    <Heading
      as="h1"
      style={{
        fontFamily: fonts.heading,
        fontSize: '32px',
        fontWeight: '700',
        fontStyle: 'italic',
        letterSpacing: '-0.025em',
        lineHeight: '1.08',
        color: colors.text,
        margin: '16px 0 12px',
        textAlign: 'center',
      }}
    >
      {line1}
      {line2 && (
        <>
          <br />
          <span style={{ color: line2Color }}>{line2}</span>
        </>
      )}
    </Heading>
  )
}
