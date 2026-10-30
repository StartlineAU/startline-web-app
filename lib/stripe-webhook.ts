import type Stripe from "stripe";
import type { CompactParticipant } from "@/lib/registration-form";

/**
 * Parse participant data written into PaymentIntent metadata by the checkout
 * route. Supports the modern multi-participant format (participantCount +
 * participant0..N) and the legacy single-ticket fields.
 */
export function parseParticipantsFromMetadata(meta: Stripe.Metadata): CompactParticipant[] {
  const participantCount = parseInt(meta.participantCount ?? "0", 10);
  if (participantCount > 0) {
    const participants: CompactParticipant[] = [];
    for (let i = 0; i < participantCount; i++) {
      const raw = meta[`participant${i}`];
      if (!raw) continue;
      participants.push(JSON.parse(raw) as CompactParticipant);
    }
    if (participants.length > 0) return participants;
  }

  if (meta.firstName || meta.userName) {
    return [{
      fn: meta.firstName ?? meta.userName?.split(" ")[0] ?? "",
      ln: meta.lastName ?? meta.userName?.split(" ").slice(1).join(" ") ?? "",
      dob: meta.dateOfBirth ?? "",
      em: (meta.userEmail ?? "").toLowerCase(),
      mob: meta.mobile ?? "",
      ecn: meta.emergencyContactName ?? "",
      ecp: meta.emergencyContactPhone ?? "",
    }];
  }

  return [];
}

/** Stripe's own limits. Asserted before the PaymentIntent call, not discovered from a 400. */
export const STRIPE_METADATA_MAX_KEYS = 50;
export const STRIPE_METADATA_MAX_VALUE_CHARS = 500;

/**
 * Refuse to call Stripe with metadata it will reject. Throwing here fails the
 * checkout request cleanly; discovering it from Stripe would mean an athlete
 * watching a card form die for no stated reason.
 */
export function assertMetadataBudget(meta: Record<string, string>): void {
  const keys = Object.keys(meta);
  if (keys.length > STRIPE_METADATA_MAX_KEYS) {
    throw new Error(
      `PaymentIntent metadata needs ${keys.length} keys, over Stripe's limit of ${STRIPE_METADATA_MAX_KEYS}.`,
    );
  }
  for (const key of keys) {
    if (meta[key].length > STRIPE_METADATA_MAX_VALUE_CHARS) {
      throw new Error(
        `PaymentIntent metadata key "${key}" is ${meta[key].length} characters, ` +
          `over Stripe's limit of ${STRIPE_METADATA_MAX_VALUE_CHARS}.`,
      );
    }
  }
}
