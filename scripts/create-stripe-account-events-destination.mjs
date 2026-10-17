/**
 * Creates the Stripe event destination for Accounts v2 events (issue #379) and
 * prints its signing secret.
 *
 * v2 account events never reach the v1 webhook endpoint, so each Stripe mode
 * needs its own destination pointing at /api/stripe/account-events. Run once per
 * environment with that environment's key, then store the printed secret in the
 * startline/automation secret as stripe_account_events_secret_<env> and apply
 * Terraform. The Dashboard can reveal the secret again later.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... node scripts/create-stripe-account-events-destination.mjs https://startlineau.com
 *
 * Keep EVENT_TYPES in step with ACCOUNT_EVENT_TYPES in lib/stripe-connect.ts.
 */
import Stripe from "stripe";
import { loadEnv } from "./lib/env.mjs";
import { STRIPE_API_VERSION } from "./lib/stripe-test.mjs";

const EVENT_TYPES = [
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[requirements].updated",
];

loadEnv();

const baseUrl = process.argv[2];
const key = process.env.STRIPE_SECRET_KEY;

if (!baseUrl || !/^https:\/\//.test(baseUrl)) {
  console.error("Pass the environment's https base URL, e.g. https://startlineau.com");
  process.exit(1);
}
if (!key) {
  console.error("Set STRIPE_SECRET_KEY to the key of the Stripe mode this destination belongs to.");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
const url = new URL("/api/stripe/account-events", baseUrl).toString();

const destination = await stripe.v2.core.eventDestinations.create({
  name:             "startline-account-events",
  description:      "Accounts v2 onboarding status for organiser accounts",
  type:             "webhook_endpoint",
  event_payload:    "thin",
  enabled_events:   EVENT_TYPES,
  // v2 account events are emitted on the platform, but take connected
  // accounts' events too so nothing depends on which side Stripe uses.
  events_from:      ["@self", "@accounts"],
  webhook_endpoint: { url },
  include:          ["webhook_endpoint.signing_secret", "webhook_endpoint.url"],
});

console.log(`Created ${destination.id} -> ${destination.webhook_endpoint?.url}`);
console.log(`Mode: ${key.startsWith("sk_live_") ? "live" : "test"}`);
console.log(`Signing secret: ${destination.webhook_endpoint?.signing_secret}`);
