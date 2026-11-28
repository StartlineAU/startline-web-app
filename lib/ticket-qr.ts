/**
 * The opaque payload carried by an athlete's ticket QR.
 *
 * Keep this deliberately small and non-descriptive: the scanner route resolves
 * the token against the event being scanned, so the QR contains no name,
 * email, bib or registration id.
 */
export const TICKET_QR_PREFIX = "SLT1:";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ticketQrPayload(ticketToken: string): string {
  return `${TICKET_QR_PREFIX}${ticketToken}`;
}

/** The token inside a scanned QR, or null for anything else. */
export function parseTicketQrPayload(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith(TICKET_QR_PREFIX)) return null;
  const token = trimmed.slice(TICKET_QR_PREFIX.length);
  return UUID.test(token) ? token : null;
}
