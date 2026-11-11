// Email design tokens. Values come from design/design.md: dark only, one
// accent (signal green), Chakra Petch for structure and Inter for prose.
// Email clients ignore CSS variables, so every component reads these instead.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://startlineau.com'

export const colors = {
  bg:      '#141414', // --darker, page
  surface: '#1F1F1F', // --dark, the card
  well:    '#2A2A2A', // --dark-light, nested wells
  border:  '#353535', // --dark-lighter, hairlines
  text:    '#F5F7FA', // --light
  soft:    '#C9CDD3', // secondary text that still needs to read as content
  muted:   '#8A8F98', // --muted
  faint:   '#6E737B', // --muted-dark
  primary: '#B3E153', // signal green
  ink:     '#141414', // text on green, always
} as const

/** Status colours: only ever for status, never decoration (design.md §2). */
export const status = {
  success: '#B3E153',
  info:    '#60A5FA',
  danger:  '#F87171',
  warning: '#FBBF24',
} as const

export type Tone = keyof typeof status

export const fonts = {
  heading: "'Chakra Petch', Arial, Helvetica, sans-serif",
  body:    "'Inter', Arial, Helvetica, sans-serif",
} as const

/** design.md §3 scale. */
export const size = {
  eyebrow: '10px',
  label:   '11px',
  meta:    '12px',
  sm:      '13px',
  body:    '15px',
  md:      '16px',
  lg:      '20px',
  xl:      '24px',
  '2xl':   '30px',
  '4xl':   '52px',
} as const

/** Uppercase, wide-tracked structural label (design.md §3). */
export const labelStyle: React.CSSProperties = {
  margin: '0',
  fontFamily: fonts.heading,
  fontSize: size.label,
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: colors.muted,
  lineHeight: '1.4',
}

/** Table reset that keeps clients from drawing default cell borders. */
export const tableReset: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0',
}
