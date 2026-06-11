export const PLATFORM_FEE_PERCENT = 0.0395;
export const PLATFORM_FEE_FIXED_CENTS = 145;

export function calculatePlatformFee(amountCents: number): number {
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
