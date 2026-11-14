import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/checkout/accept-terms
//
// The review step calls this when the athlete has ticked the terms and waiver
// and pressed pay, just before the card is charged. It stamps the time on the
// PaymentIntent, and the webhook stores the entry's waiverAccepted from that
// stamp rather than assuming it.
//
// The caller proves the payment is theirs with the PaymentIntent's client
// secret, the same credential that lets them confirm it. Checkout works for
// guests, so there may be no session to check instead.

const bodySchema = z.object({
  clientSecret: z.string().min(1).max(255),
});

const SECRET_SHAPE = /^(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+$/;

export async function POST(req: NextRequest) {
  const blocked = await rateLimit(req, { prefix: "accept-terms", limit: 20, windowSeconds: 600 });
  if (blocked) return blocked;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  const match = parsed.success ? SECRET_SHAPE.exec(parsed.data.clientSecret) : null;
  if (!parsed.success || !match) {
    return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
  }
  const clientSecret = parsed.data.clientSecret;
  const paymentIntentId = match[1];

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const expected = Buffer.from(paymentIntent.client_secret ?? "");
    const given = Buffer.from(clientSecret);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
    }
    // Only a checkout PaymentIntent that has not been paid yet.
    if (!paymentIntent.metadata?.eventId || paymentIntent.status === "succeeded" || paymentIntent.status === "canceled") {
      return NextResponse.json({ error: "This payment can no longer be changed." }, { status: 409 });
    }

    if (!paymentIntent.metadata.termsAcceptedAt) {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: { termsAcceptedAt: new Date().toISOString() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Accept terms error:", err);
    return NextResponse.json({ error: "Could not record your acceptance. Please try again." }, { status: 503 });
  }
}
