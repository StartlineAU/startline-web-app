import type { RegistrationStatus } from "@prisma/client";

/**
 * Which registration status changes an organiser may make by hand.
 *
 * Statuses on a paid entry are money state: payouts count CONFIRMED entries,
 * the admin refund queue reads REFUND_REQUESTED, and REFUNDED means Stripe has
 * returned the money. Letting an organiser write them directly let a refund be
 * "granted" without any money moving, or a refunded entry be paid out again.
 * Paid entries therefore only change through the athlete refund request and
 * the admin refund, which move the money in step.
 *
 * Taking someone out of an event is not a status edit at all: it goes through
 * Remove from event (lib/remove-registration.ts), which records why, tells the
 * athlete, refunds a paid entry and frees the bib and wave (#571). The edit
 * dialog used to offer Cancelled as a quiet removal that did none of that.
 * What is left here is reinstating a free entry that was cancelled, capacity
 * permitting. A REMOVED entry is final.
 */

export type EntryForStatusChange = {
  status: RegistrationStatus;
  amountCents: number;
  platformFeeCents: number;
  stripePaymentIntentId: string | null;
};

export type StatusChangeDecision =
  | { ok: true; change: false }
  | { ok: true; change: true; reinstating: boolean }
  | { ok: false; error: string };

export const USE_REMOVE_ERROR =
  "To take someone out of the event, use Remove from event. It tells the athlete and frees their place.";

export const REMOVED_STATUS_ERROR = "This athlete was removed from the event. Removal can't be undone.";

export const PAID_STATUS_ERROR =
  "Paid entries change status only through a refund. The athlete requests it from their activity, and Startline processes it.";

export function isFreeEntry(entry: Omit<EntryForStatusChange, "status">): boolean {
  return entry.amountCents === 0 && entry.platformFeeCents === 0 && !entry.stripePaymentIntentId;
}

export function organiserStatusChange(
  entry: EntryForStatusChange,
  next: RegistrationStatus,
): StatusChangeDecision {
  // The edit dialog always sends the status back, so the current one is a no-op
  // whatever the entry is.
  if (next === entry.status) return { ok: true, change: false };

  if (entry.status === "REMOVED") return { ok: false, error: REMOVED_STATUS_ERROR };
  if (next === "REMOVED" || next === "CANCELLED") return { ok: false, error: USE_REMOVE_ERROR };

  if (!isFreeEntry(entry)) return { ok: false, error: PAID_STATUS_ERROR };

  if (entry.status === "CANCELLED" && next === "CONFIRMED") {
    return { ok: true, change: true, reinstating: true };
  }
  return { ok: false, error: "A free entry can only be reinstated." };
}
