import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";

// Startline stores only the account reference ID.
// Stripe holds DOB and bank account details directly (ToS §3.3, Privacy Policy §4.2).
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const stripe = getStripe();

    const organiser = await prisma.organiser.findUnique({
      where:  { id: session.sub },
      select: { stripeAccountId: true, email: true },
    });

    if (!organiser) return NextResponse.json({ error: "Organiser not found." }, { status: 404 });

    let accountId = organiser.stripeAccountId;

    // Create a new Express account if one doesn't exist yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type:    "express",
        country: "AU",
        email:   organiser.email,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        business_type: "individual",
        settings: {
          payouts: {
            schedule: { interval: "manual" },
          },
        },
      });

      accountId = account.id;

      await prisma.organiser.update({
        where: { id: session.sub },
        data:  { stripeAccountId: accountId },
      });
    }

    // Generate a fresh Account Link for the hosted onboarding flow
    const accountLink = await stripe.accountLinks.create({
      account:     accountId,
      refresh_url: `${SITE}/organiser/payments?refresh=1`,
      return_url:  `${SITE}/organiser/payments/return`,
      type:        "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error("Stripe connect error:", err);
    return NextResponse.json({ error: "Failed to create Stripe onboarding link." }, { status: 503 });
  }
}
