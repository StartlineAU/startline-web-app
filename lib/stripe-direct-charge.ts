/**
 * Dev-only: charge on the platform account with no Connect destination, so
 * checkout works locally without an onboarded organiser. In production that
 * would keep every athlete's payment on the platform and skip the organiser
 * entirely, so a production build ignores the variable whatever it is set to.
 */
export function isDevDirectCharge(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.STRIPE_DEV_DIRECT_CHARGE === "true";
}
