import { render } from '@react-email/render'
import type { ReactElement } from 'react'

export interface RenderedEmail {
  html: string
  /** Plain-text part, so clients that block HTML still read the email. */
  text: string
}

export async function renderEmail(element: ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])
  return { html, text }
}
