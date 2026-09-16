import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { getStripe } from "@/lib/stripe";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";
import {
  buildRefundParams,
  entryRefundAmountCents,
  isOutsidePolicyRefund,
} from "@/lib/stripe-refunds";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        amountCents: true,
        platformFeeCents: true,
        feeStructure: true,
        refundAmountCents: true,
        refundPercent: true,
        stripePaymentIntentId: true,
        athleteName: true,
        userId: true,
        event: { select: { id: true, title: true } },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    if (registration.status !== "CONFIRMED" && registration.status !== "REFUND_REQUESTED") {
      return NextResponse.json(
        { error: "Only confirmed or refund-requested registrations can be refunded." },
        { status: 409 },
      );
    }

    // Tell the athlete their refund went through. Best-effort in every case: the
    // status change is what matters, so a notification failure must never turn a
    // successful refund into an error.
    const notifyAthlete = async (cents: number) => {
      if (!registration.userId) return;
      try {
        await prisma.userNotification.create({
          data: {
            userId: registration.userId,
            type: "REFUND_PROCESSED",
            title: "Refund processed",
            body:
              cents > 0
                ? `Your refund of $${(cents / 100).toFixed(2)} for ${registration.event.title} is on its way ` +
                  `back to your original payment method. Allow 5 to 10 business days.`
                : `Your entry to ${registration.event.title} has been cancelled and released.`,
            eventId: registration.event.id,
          },
        });
      } catch {
        // Swallowed on purpose — see above.
      }
    };

    // Free or external registration — just flip the status
    if (!registration.stripePaymentIntentId) {
      await prisma.registration.update({ where: { id }, data: { status: "REFUNDED" } });
      writeAuditLog({
        adminId: session.sub,
        action: "REFUND_REGISTRATION",
        targetType: "registration",
        targetId: id,
        meta: { method: "free", athleteName: registration.athleteName },
      });
      await notifyAthlete(0);
      return NextResponse.json({ ok: true, method: "free" });
    }

    // Honour the snapshot taken when the athlete asked, clamped to what THIS
    // entry's payer actually handed over. Under the "organiser" fee structure
    // that is the ticket price alone: the booking fee came out of the
    // organiser's share, so it is not the athlete's to receive back.
    //
    // The amount is always explicit. An amountless refund returns the entire
    // charge, and one PaymentIntent covers every participant in a group booking,
    // so that would refund the whole family over one athlete's request.
    const refundCents = entryRefundAmountCents(registration);

    // Checked before touching Stripe so a refused request costs nothing.
    if (isOutsidePolicyRefund(registration)) {
      return NextResponse.json(
        { error: "This request is outside the event's refund policy. Refund a different amount manually in Stripe if it is being granted as a goodwill exception." },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    // The charge is expanded rather than left as an id because the refund needs
    // two facts that only exist on the Charge: whether there is a transfer to
    // reverse and whether there is an application fee. Checkout omits both for a
    // direct charge, and Stripe rejects a refund that claims either one is there
    // when it is not.
    const paymentIntent = await stripe.paymentIntents.retrieve(
      registration.stripePaymentIntentId,
      { expand: ["latest_charge"] },
    );

    const latestCharge = paymentIntent.latest_charge;

    if (!latestCharge) {
      return NextResponse.json(
        { error: "No charge found on this payment intent." },
        { status: 422 },
      );
    }

    // Expanded above, so a bare id here means the expansion did not come back
    // and we cannot prove what the charge carries. Guessing moves real money in
    // the wrong direction either way, so refuse rather than send a refund whose
    // flags might not match the charge.
    if (typeof latestCharge === "string") {
      return NextResponse.json(
        { error: "Could not read the charge for this payment. Try again in a moment." },
        { status: 502 },
      );
    }

    const charge = latestCharge;

    const refund = await stripe.refunds.create(
      ...buildRefundParams({
        chargeId: charge.id,
        amountCents: refundCents,
        // Retrying a failed request must not refund the athlete twice. Note
        // Stripe expires an idempotency key after 24 hours, so a refund that
        // failed for a transient reason can still be retried tomorrow.
        idempotencyKey: `entry-refund-${registration.id}`,
        hasTransfer: Boolean(charge.transfer),
        hasApplicationFee: Boolean(charge.application_fee),
      }),
    );

    await prisma.registration.update({ where: { id }, data: { status: "REFUNDED" } });

    await notifyAthlete(refundCents);

    writeAuditLog({
      adminId: session.sub,
      action: "REFUND_REGISTRATION",
      targetType: "registration",
      targetId: id,
      meta: {
        stripeRefundId: refund.id,
        amountCents: registration.amountCents,
        athleteName: registration.athleteName,
      },
    });

    return NextResponse.json({ ok: true, refundId: refund.id });
  } catch (err) {
    console.error("Admin refund error:", err);
    return NextResponse.json({ error: "Refund failed." }, { status: 503 });
  }
}
