import { NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { isOnboardingComplete, retrieveConnectStatus } from "@/lib/stripe-connect";

export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const organiser = await prisma.organiser.findUnique({
      where:  { id: session.sub },
      select: { stripeAccountId: true, stripeOnboardingComplete: true },
    });

    if (!organiser?.stripeAccountId) {
      return NextResponse.json({ connected: false, chargesEnabled: false, payoutsEnabled: false, actionRequired: true });
    }

    if (organiser.stripeOnboardingComplete) {
      return NextResponse.json({ connected: true, chargesEnabled: true, payoutsEnabled: true, actionRequired: false });
    }

    const status = await retrieveConnectStatus(getStripe(), organiser.stripeAccountId);

    if (isOnboardingComplete(status)) {
      await prisma.organiser.update({
        where: { id: session.sub },
        data:  { stripeOnboardingComplete: true },
      });
    }

    return NextResponse.json({ connected: true, ...status });
  } catch (err) {
    console.error("Stripe status error:", err);
    return NextResponse.json({ error: "Failed to check Stripe status." }, { status: 503 });
  }
}
