export const PLATFORM_FEE_PERCENT = 0.0395;
export const PLATFORM_FEE_FIXED_CENTS = 145;

/**
 * Startline's cut of a ticket: a percentage plus a fixed component.
 *
 * A free ticket carries no fee at all. The fixed component is not a
 * subscription — it is a share of a sale — so applying it to a $0 ticket would
 * either charge an athlete A$1.45 to enter a free event (athlete-pays) or hand
 * Stripe an application fee larger than the charge (organiser-pays). Both are
 * wrong, so a zero (or nonsensical negative) price yields a zero fee.
 */
export function calculatePlatformFee(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FIXED_CENTS;
}

export function calculateTotalWithFee(amountCents: number, feeStructure: string): {
  totalCents: number;
  platformFeeCents: number;
} {
  const fee = calculatePlatformFee(amountCents);
  if (feeStructure === "athlete") {
    return { totalCents: amountCents + fee, platformFeeCents: fee };
  }
  return { totalCents: amountCents, platformFeeCents: fee };
}

// ─── Paid add-ons (event merchandise) ────────────────────────────────────────
// Add-ons are charged a percentage only, with no fixed component. The $1.45
// covers the per-registration cost — Stripe's per-charge fee, the confirmation
// email, wave assignment, support — and an add-on rides on the same charge and
// the same registration, adding none of it. Charging it again would take 9.8%
// on a $25 tee, and a family buying four would pay $5.80 in booking fees for a
// single shipment.
//
// These are additions. calculatePlatformFee above stays byte-identical so the
// ticket path cannot move a cent.

export function calculateAddOnPlatformFee(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_PERCENT);
}

export function calculateAddOnTotalWithFee(amountCents: number, feeStructure: string): {
  totalCents: number;
  platformFeeCents: number;
} {
  const fee = calculateAddOnPlatformFee(amountCents);
  if (feeStructure === "athlete") {
    return { totalCents: amountCents + fee, platformFeeCents: fee };
  }
  return { totalCents: amountCents, platformFeeCents: fee };
}
