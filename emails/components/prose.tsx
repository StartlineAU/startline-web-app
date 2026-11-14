import { colors, fonts, size } from './tokens'

interface ProseProps {
  children: React.ReactNode
  muted?: boolean
  /** Extra space above, for a paragraph that follows a card. */
  spaced?: boolean
}

/**
 * A body paragraph in Inter, sentence case. Pass one string where the copy
 * mixes in values: JSX splits adjacent text with `<!-- -->` markers.
 */
export function Prose({ children, muted, spaced }: ProseProps) {
  return (
    <p
      className="sl-gutter"
      style={{
        margin: '0',
        padding: `${spaced ? '24px' : '0'} 40px 16px`,
        fontFamily: fonts.body,
        fontSize: size.body,
        lineHeight: '1.65',
        color: muted ? colors.muted : colors.soft,
        whiteSpace: 'pre-wrap',
      }}
    >
      {children}
    </p>
  )
}
