// Exact design tokens from the app's CSS vars and globals.css
export const C = {
  // Primary — rgb(179, 225, 83) #B3E153
  primary:      '#B3E153',
  primaryLight: '#C2EC77',
  primaryDark:  '#A4D62F',

  // Dark theme backgrounds
  darker:      '#141414',  // rgb(20,20,20)   — body bg
  dark:        '#1f1f1f',  // rgb(31,31,31)   — card bg
  darkLight:   '#2a2a2a',  // rgb(42,42,42)
  darkLighter: '#353535',  // rgb(53,53,53)

  // Text
  light:     '#F5F7FA',  // rgb(245,247,250)
  muted:     '#8A8F98',  // rgb(138,143,152)
  mutedDark: '#6E737B',  // rgb(110,115,123)

  // Light-mode palette (Dashboard scene)
  white:   '#FFFFFF',
  gray50:  '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
  lime50:  '#F7FEE7',
  lime100: '#ECFCCB',
  lime500: '#84CC16',
  lime600: '#65A30D',
  lime700: '#4D7C0F',
} as const;

// Shorthand for inline extrapolate clamp
export const CLAMP = {
  extrapolateLeft:  'clamp',
  extrapolateRight: 'clamp',
} as const;
