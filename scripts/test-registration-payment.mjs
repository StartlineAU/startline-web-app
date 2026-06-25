/**
 * End-to-end registration payment test (Phase 2).
 * Creates checkout, confirms payment with test card, verifies Registration in DB.
 *
 * Usage: node scripts/test-registration-payment.mjs
 */
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const EVENT_ID = "seed-event-001";

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY not set");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });
  const prisma = new PrismaClient();

  const athleteEmail = `test.registration.${Date.now()}@example.com`;
  const athleteName = "Test Registration User";

  try {
    console.log("1. Creating checkout session…");
    const checkoutRes = await fetch(`${BASE}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: EVENT_ID,
        waveLabel: "Early Bird",
        firstName: "Test",
        lastName: "Registration",
        dateOfBirth: "1990-01-15",
        email: athleteEmail,
        mobile: "0400000000",
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "0400000001",
        waiverAccepted: true,
      }),
    });
    const checkout = await checkoutRes.json();
    if (!checkoutRes.ok || !checkout.paymentIntentId) {
      console.error("Checkout failed:", checkout);
      process.exit(1);
    }
    console.log(`   PaymentIntent: ${checkout.paymentIntentId}`);

    console.log("2. Confirming payment with test card 4242…");
    const confirmed = await stripe.paymentIntents.confirm(checkout.paymentIntentId, {
      payment_method: "pm_card_visa",
      return_url: `${BASE}/events/${EVENT_ID}/register/confirmation`,
    });

    if (confirmed.status !== "succeeded") {
      console.error("Payment not succeeded:", confirmed.status);
      process.exit(1);
    }
    console.log(`   Payment status: ${confirmed.status}`);

    console.log("3. Waiting for webhook to create registration…");
    let registration = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      registration = await prisma.registration.findFirst({
        where: { stripePaymentIntentId: checkout.paymentIntentId },
      });
      if (registration) break;
    }

    if (!registration) {
      console.error("Registration not found after payment. Is stripe listen running?");
      process.exit(1);
    }

    console.log("\nRegistration created:");
    console.log(`  id:           ${registration.id}`);
    console.log(`  athleteName:  ${registration.athleteName}`);
    console.log(`  athleteEmail: ${registration.athleteEmail}`);
    console.log(`  waveLabel:    ${registration.waveLabel}`);
    console.log(`  amountCents:  ${registration.amountCents}`);
    console.log(`  status:       ${registration.status}`);
    console.log("\nPhase 2 payment test passed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
