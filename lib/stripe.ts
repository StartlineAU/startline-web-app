import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** False on a deployment whose runtime was never given STRIPE_SECRET_KEY. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  // The app deliberately stays on the API version it was built against.
  // @ts-expect-error v23's types only describe the current API version.
  _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return _stripe;
}
