export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://startlineau.com'

export const colors = {
  bg:      '#141414',
  surface: '#1F1F1F',
  well:    '#252525',
  deep:    '#2A2A2A',
  border:  '#303030',
  row:     '#1A1A1A',
  text:    '#F5F7FA',
  muted:   '#8A8F98',
  faint:   '#6E737B',
  primary: '#B3E153',
} as const

export const fonts = {
  heading: "'Chakra Petch', Arial, sans-serif",
  body:    "'Inter', Arial, sans-serif",
} as const

export const BADGE_CONFIG = {
  success:  { bg: 'rgba(179,225,83,0.12)',  border: 'rgba(179,225,83,0.2)',  color: '#B3E153', label: 'CONFIRMED'        },
  warning:  { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.2)',  color: '#FBBF24', label: 'IMPORTANT UPDATE' },
  danger:   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.2)', color: '#F87171', label: 'EVENT CANCELLED'  },
  info:     { bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.2)',  color: '#60A5FA', label: 'SPOT AVAILABLE'   },
  security: { bg: 'rgba(179,225,83,0.08)',  border: 'rgba(179,225,83,0.15)', color: '#B3E153', label: 'ACCOUNT SECURITY' },
} as const

export type BadgeType = keyof typeof BADGE_CONFIG
