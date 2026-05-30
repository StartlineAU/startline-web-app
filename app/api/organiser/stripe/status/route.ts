import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getOrganiserSession } from "@/lib/amplify-server";
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

export async function GET() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const organiser = await prisma.organiser.findUnique({
      where:  { id: session.sub },
      select: { stripeAccountId: true, stripeOnboardingComplete: true },
    });

    if (!organiser?.stripeAccountId) {
      return NextResponse.json({ connected: false, chargesEnabled: false, payoutsEnabled: false });
    }

    if (organiser.stripeOnboardingComplete) {
      return NextResponse.json({ connected: true, chargesEnabled: true, payoutsEnabled: true });
    }

    const stripe  = getStripe();
    const account = await stripe.accounts.retrieve(organiser.stripeAccountId);

    const chargesEnabled  = account.charges_enabled  ?? false;
    const payoutsEnabled  = account.payouts_enabled   ?? false;
    const fullyOnboarded  = chargesEnabled && payoutsEnabled;

    if (fullyOnboarded) {
      await prisma.organiser.update({
        where: { id: session.sub },
        data:  { stripeOnboardingComplete: true },
      });
    }

    return NextResponse.json({ connected: true, chargesEnabled, payoutsEnabled });
  } catch (err) {
    console.error("Stripe status error:", err);
    return NextResponse.json({ error: "Failed to check Stripe status." }, { status: 503 });
  }
}
