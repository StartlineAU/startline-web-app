import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { getStripe } from "@/lib/stripe";
import { idItemIdParams } from "@/lib/schemas";
import { addOnRefundAmountCents, canDecideAddOnRefund } from "@/lib/add-on-refunds";
import { buildRefundParams } from "@/lib/stripe-refunds";
import { addOnStockLabel } from "@/lib/add-ons";
import { z } from "zod";

const bodySchema = z.object({
  decision: z.enum(["approve", "decline"]),
  reason: z.string().max(1000).optional(),
});

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * POST — the organiser approves or declines one add-on refund request.
 *
 * A decline returns the item to PURCHASED and stamps refundDeclinedAt, rather
 * than needing its own status: the athlete still owns the shirt, and the row
 * still holds its unit of stock.
 *
 * An approval calls Stripe first and persists second. stripeRefundId is unique,
 * so a retry after a failed write cannot refund twice, and the idempotency key
 * means Stripe itself collapses the duplicate.
 *
 * The registration is never touched either way. Merchandise and entry are
 * separate transactions riding the same charge: refunding one leaves the other
 * exactly as it was.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idItemIdParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id, itemId } = parsedParams.data;

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Choose approve or decline." }, { status: 400 });
  }
  const { decision, reason } = parsedBody.data;

  const item = await prisma.registrationAddOn.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      eventId: true,
      status: true,
      amountCents: true,
      platformFeeCents: true,
      feeStructure: true,
      quantity: true,
      nameSnapshot: true,
      variantLabelSnapshot: true,
      refundAmountCents: true,
      stripeRefundId: true,
      registration: {
        select: {
          id: true,
          userId: true,
          stripePaymentIntentId: true,
          event: { select: { id: true, title: true, organiserId: true } },
        },
      },
    },
  });

  if (!item || item.eventId !== id) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }
  if (item.registration.event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const allowed = canDecideAddOnRefund(item);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.reason }, { status: allowed.status });
  }

  const label = addOnStockLabel(item.nameSnapshot, item.variantLabelSnapshot);

  // refundDecidedBy below records session.sub, which requireOrganiser resolves to
  // the Organiser id rather than the member who clicked. An organiser can have
  // several members and OrganiserSession does not carry the acting user, so this
  // says which organiser decided, not which person. Same granularity as every
  // other organiser-side write.

  // Best-effort athlete notification; the decision itself is what matters.
  const notifyAthlete = async (title: string, body: string) => {
    if (!item.registration.userId) return;
    try {
      await prisma.userNotification.create({
        data: {
          userId: item.registration.userId,
          type: "REFUND_PROCESSED",
          title,
          body,
          eventId: item.registration.event.id,
        },
      });
    } catch (err) {
      console.error("Failed to notify athlete of add-on refund decision:", err);
    }
  };

  if (decision === "decline") {
    await prisma.registrationAddOn.update({
      where: { id: itemId },
      data: {
        // Back to PURCHASED: the athlete keeps the item and it keeps its stock.
        status: "PURCHASED",
        refundDeclinedAt: new Date(),
        refundDeclineReason: reason?.trim() || null,
        refundDecidedAt: new Date(),
        refundDecidedBy: session.sub,
      },
    });

    await notifyAthlete(
      "Refund request declined",
      `The organiser declined your refund request for ${item.quantity} x ${label} ` +
        `at ${item.registration.event.title}.` +
        (reason?.trim() ? ` Reason: ${reason.trim()}` : ""),
    );

    return NextResponse.json({ ok: true, status: "PURCHASED" });
  }

  // ── Approve ──────────────────────────────────────────────────────────────
  // Honour the amount frozen when the athlete asked, so the figure they were
  // shown is the figure they receive.
  const refundCents = item.refundAmountCents ?? addOnRefundAmountCents(item);
  if (refundCents <= 0) {
    return NextResponse.json(
      { error: "There is nothing to refund on this item." },
      { status: 409 },
    );
  }

  if (!item.registration.stripePaymentIntentId) {
    // A comped or imported entry: nothing was charged, so nothing is returned.
    await prisma.registrationAddOn.update({
      where: { id: itemId },
      data: {
        status: "REFUNDED",
        refundDecidedAt: new Date(),
        refundDecidedBy: session.sub,
      },
    });
    await notifyAthlete(
      "Refund approved",
      `Your refund for ${item.quantity} x ${label} at ${item.registration.event.title} was approved.`,
    );
    return NextResponse.json({ ok: true, status: "REFUNDED", method: "free" });
  }

  let refundId: string;
  try {
    const stripe = getStripe();
    // The charge is expanded rather than left as an id because the refund needs
    // two facts that only exist on the Charge: whether there is a transfer to
    // reverse and whether there is an application fee. Checkout omits both for a
    // direct charge, and Stripe rejects a refund that claims either one is there
    // when it is not.
    const paymentIntent = await stripe.paymentIntents.retrieve(
      item.registration.stripePaymentIntentId,
      { expand: ["latest_charge"] },
    );

    const latestCharge = paymentIntent.latest_charge;
    if (!latestCharge) {
      return NextResponse.json({ error: "No charge found on this payment." }, { status: 422 });
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

    const refund = await stripe.refunds.create(
      ...buildRefundParams({
        chargeId: latestCharge.id,
        // Explicit amount: one PaymentIntent covers every participant in a group
        // booking and all of their merchandise. An amountless refund would
        // return the entire charge.
        amountCents: refundCents,
        // Keyed on the item, so a retry after a failed write cannot refund the
        // same shirt twice. Stripe expires the key after 24 hours, so a refund
        // that failed for a transient reason can still be retried tomorrow.
        idempotencyKey: `addon-refund-${item.id}`,
        hasTransfer: Boolean(latestCharge.transfer),
        hasApplicationFee: Boolean(latestCharge.application_fee),
      }),
    );
    refundId = refund.id;
  } catch (err) {
    console.error("Add-on refund failed:", itemId, err);
    return NextResponse.json(
      { error: "Stripe could not process this refund. Nothing has been changed." },
      { status: 502 },
    );
  }

  // Stripe first, database second. The unique stripeRefundId means a retry after
  // a failed write cannot double-refund.
  await prisma.registrationAddOn.update({
    where: { id: itemId },
    data: {
      status: "REFUNDED",
      refundAmountCents: refundCents,
      refundDecidedAt: new Date(),
      refundDecidedBy: session.sub,
      stripeRefundId: refundId,
    },
  });

  await notifyAthlete(
    "Refund approved",
    `Your refund of ${formatCents(refundCents)} for ${item.quantity} x ${label} at ` +
      `${item.registration.event.title} is on its way back to your original payment method. ` +
      `Allow 5 to 10 business days.`,
  );

  return NextResponse.json({ ok: true, status: "REFUNDED", refundId, refundCents });
}
