#!/usr/bin/env node
// One-off: remove participant personal details from existing PaymentIntents.
//
// Before pending_orders, checkout kept participant and buyer details in
// PaymentIntent metadata. New intents carry only an order id. This clears
// those keys from older intents. Stripe deletes
// a metadata key when it is set to an empty string.
//
// The webhook has already written every paid intent's entries to the
// database, so nothing reads these keys again. Run it once per Stripe mode
// AFTER the pending_orders release is live, or an intent still open in
// someone's checkout loses the details its webhook needs and is refunded.
//
//   STRIPE_SECRET_KEY=sk_... node scripts/scrub-stripe-metadata.mjs           # dry run
//   STRIPE_SECRET_KEY=sk_... node scripts/scrub-stripe-metadata.mjs --apply   # write
//
// Scrubbing an intent that is still awaiting payment would break it, so only
// succeeded, canceled and expired-checkout intents are touched.

import Stripe from "stripe";
import { STRIPE_API_VERSION } from "./lib/stripe-test.mjs";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required.");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });

const PRIVATE_KEY = /^(participant\d+|teams|userName|userEmail|userId|firstName|lastName|dateOfBirth|mobile|emergencyContactName|emergencyContactPhone)$/;
// An open intent older than this is an abandoned checkout, not a live one.
const ABANDONED_AFTER_SECONDS = 2 * 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);

let scanned = 0;
let scrubbed = 0;
let skippedOpen = 0;
let failed = 0;

for await (const intent of stripe.paymentIntents.list({ limit: 100 })) {
  scanned++;
  const keys = Object.keys(intent.metadata ?? {}).filter((k) => PRIVATE_KEY.test(k));
  if (keys.length === 0) continue;

  const settled = intent.status === "succeeded" || intent.status === "canceled";
  const abandoned = now - intent.created > ABANDONED_AFTER_SECONDS;
  if (!settled && !abandoned) {
    skippedOpen++;
    continue;
  }

  console.log(`${apply ? "scrub" : "would scrub"} ${intent.id} (${intent.status}): ${keys.length} key(s)`);
  if (apply) {
    // One refusal (Stripe limits what a settled intent accepts) must not stop
    // the run; it is listed so it can be cleared by hand in the Dashboard.
    try {
      await stripe.paymentIntents.update(intent.id, {
        metadata: Object.fromEntries(keys.map((k) => [k, ""])),
      });
    } catch (err) {
      failed++;
      console.error(`  could not scrub ${intent.id}: ${err?.message ?? err}`);
      continue;
    }
  }
  scrubbed++;
}

console.log(
  `\nScanned ${scanned} PaymentIntents. ${apply ? "Scrubbed" : "Would scrub"} ${scrubbed}.` +
    (skippedOpen ? ` Left ${skippedOpen} still-open checkout(s); run again in two days.` : "") +
    (failed ? ` ${failed} could not be updated; see the errors above.` : "") +
    (apply ? "" : "\nDry run. Pass --apply to write."),
);
