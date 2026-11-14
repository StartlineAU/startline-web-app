// Email icons are PNGs under public/email/icons, rendered at 2x from Lucide
// shapes by scripts/email-icons.mjs. Gmail and Outlook do not show SVG images.
export type EmailIcon = 'check' | 'alert' | 'alert-danger' | 'clock' | 'shield'

export function iconUrl(icon: EmailIcon, siteUrl: string): string {
  return `${siteUrl}/email/icons/${icon}.png`
}
