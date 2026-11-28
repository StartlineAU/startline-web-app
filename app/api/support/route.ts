import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { rateLimit } from "@/lib/rate-limit";
import { assertTurnstile } from "@/lib/turnstile";
import { changeOfMindQuote } from "@/lib/refund-policy";
import { entryPaidCents } from "@/lib/stripe-refunds";
import { adminUrl, organiserUrl } from "@/lib/portal-domains";
import { listAdminReviewRecipients } from "@/lib/admin-notification-recipients";
import { organiserNotificationRecipients } from "@/lib/organiser-notification-recipients";
import { organiserResponseDue } from "@/lib/refund-ticket-rules";
import { sendRefundDecisionEmail, sendRefundRequestEmail } from "@/lib/email";
import { canRequestRefund } from "@/lib/own-entry";
import { refundLinkEntry } from "@/lib/entry-refund-link";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  requestType: z.enum(["refund", "other"]),
  eventName: z.string().trim().max(200).optional(),
  eventDate: z.string().trim().max(20).optional(),
  eventId: z.string().trim().max(80).optional(),
  /** The entry to refund. Needs the athlete or buyer signed in, or `refundToken` (#492). */
  registrationId: z.string().trim().min(1).max(80).optional(),
  reason: z.string().trim().min(1).max(5000),
  turnstileToken: z.string().max(4000).optional(),
  /** From a confirmation email's "Request a refund" link. Proves the entry on its own. */
  refundToken: z.string().max(600).optional(),
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const DUE_FORMAT = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Australia/Sydney",
});

/**
 * The entry being refunded, if the caller may ask for it: the athlete or the
 * buyer, signed in (lib/own-entry.ts), or anyone holding the confirmation
 * email's refund link for exactly this entry.
 */
async function loadRefundableEntry(
  id: string,
  session: { sub: string; email: string } | null,
  linkedId: string | null,
) {
  if (!session && linkedId !== id) return null;
  const entry = await prisma.registration.findUnique({
    where: { id },
    select: {
      id: true, eventId: true, status: true, userId: true, athleteUserId: true, athleteEmail: true,
      athleteName: true, detailsPending: true,
      amountCents: true, platformFeeCents: true, feeStructure: true, soldRefundTiers: true,
      stripePaymentIntentId: true,
      event: { select: { refundTiers: true } },
    },
  });
  if (!entry) return null;
  if (linkedId === id) return entry;
  return session && canRequestRefund(entry, session) ? entry : null;
}

export async function POST(request: NextRequest) {
  const blocked = await rateLimit(request, { prefix: "support", limit: 3, windowSeconds: 60 });
  if (blocked) return blocked;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill out the required fields." }, { status: 400 });
  }
  const botBlocked = await assertTurnstile(request, parsed.data, "support");
  if (botBlocked) return botBlocked;

  const { name, email, requestType, eventName, eventDate, reason, refundToken } = parsed.data;
  const session = await getUserSession().catch(() => null);

  // A confirmation email's link stands for one entry, and proves it on its own
  // for an athlete whose sign-in address is not the one they were entered under.
  const linked = refundToken ? await refundLinkEntry(refundToken) : null;
  const registrationId = parsed.data.registrationId ?? linked?.registrationId;

  // Every refund is for one entry (#492, #614). The entry decides the event,
  // and the policy quote is taken now, so the organiser decides on a number the
  // athlete has already been shown.
  if (requestType === "refund" && !registrationId) {
    if (refundToken) {
      return NextResponse.json(
        { error: "That refund link no longer matches its entry. Sign in and choose the entry instead." },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: "Choose the entry you want refunded." }, { status: 400 });
  }
  const entry = requestType === "refund" && registrationId
    ? await loadRefundableEntry(registrationId, session, linked?.registrationId ?? null)
    : null;
  if (requestType === "refund") {
    if (!entry) {
      return session
        ? NextResponse.json(
            { error: "You can only request a refund for your own entry, or one you paid for." },
            { status: 403 },
          )
        : NextResponse.json({ error: "Sign in to request a refund." }, { status: 401 });
    }
    if (entry.status === "REFUND_REQUESTED") {
      return NextResponse.json(
        { error: "You have already asked for a refund on this entry. The organiser is deciding." },
        { status: 409 },
      );
    }
    if (entry.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Only a confirmed entry can be refunded." }, { status: 409 });
    }
    if (entryPaidCents(entry) <= 0) {
      return NextResponse.json(
        { error: "This entry was free. Withdraw from it on your Activity page instead." },
        { status: 409 },
      );
    }
    // Paid, but not through Stripe: approving would release the place and
    // report a $0 refund. Those are matched and refunded by hand.
    if (!entry.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "This entry was not paid online, so it cannot be refunded here. Contact Startline through the Contact page." },
        { status: 409 },
      );
    }
  }
  const eventId = entry?.eventId ?? parsed.data.eventId;

  // Resolve the event when the athlete picked one, so the right organisation sees it.
  const event = eventId
    ? await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true, title: true, eventDate: true, startsAtUtc: true, organiserId: true, status: true,
          organiser: {
            select: {
              email: true, contactEmail: true, notifyManagers: true, pendingClaim: true, orgName: true,
              members: { select: { role: true, user: { select: { email: true } } } },
            },
          },
        },
      })
    : null;

  if (requestType === "refund" && event?.status === "CANCELLED") {
    // Nothing to decide: a cancelled event refunds everyone in full on its own.
    return NextResponse.json(
      { error: "This event was cancelled. Everything you paid, booking fee included, is being refunded to your original payment method automatically." },
      { status: 409 },
    );
  }

  // No 24-hour block here. Inside the cutoff the change-of-mind quote is zero
  // (changeOfMindQuote), but the athlete can still ask: a changed or undelivered
  // event is owed a refund under the Australian Consumer Law whenever it is
  // raised, and the organiser can still choose goodwill.

  const eventTitle = event?.title ?? eventName ?? "";
  // A request made through an email link is recorded against the entry's own
  // address, so staff can find the entry and replies go to the inbox the link
  // proved.
  const ticketEmail = linked && entry?.id === linked.registrationId ? linked.athleteEmail : email;
  const ticketData = {
    name,
    email: ticketEmail,
    userId: session?.sub ?? null,
    requestType,
    eventName: eventTitle || null,
    eventDate: event?.eventDate ?? eventDate ?? null,
    eventId: event?.id ?? null,
    organiserId: event?.organiserId ?? null,
    reason,
  };

  let ticket: { id: string; createdAt: Date };
  let quote: { percent: number; cents: number } | null = null;
  if (entry && event) {
    const q = changeOfMindQuote({
      amountCents: entry.amountCents,
      soldRefundTiers: entry.soldRefundTiers,
      eventRefundTiers: entry.event.refundTiers,
      eventDate: event.eventDate,
      startsAtUtc: event.startsAtUtc,
    });
    quote = q;
    // The entry is held for the request, and drops out of the payout until it
    // is decided. Conditional on CONFIRMED, so a second tab or a refund issued
    // in between does not get a second ticket.
    const created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.registration.updateMany({
        where: { id: entry.id, status: "CONFIRMED" },
        data: {
          status: "REFUND_REQUESTED",
          refundRequestedAt: new Date(),
          refundPercent: q.percent,
          refundAmountCents: q.cents,
          refundOutsidePolicy: q.cents === 0,
        },
      });
      if (claimed.count !== 1) return null;
      return tx.supportTicket.create({
        data: {
          ...ticketData,
          registrationId: entry.id,
          policyRefundPercent: q.percent,
          policyRefundCents: q.cents,
        },
        select: { id: true, createdAt: true },
      });
    });
    if (!created) {
      return NextResponse.json(
        { error: "This entry changed a moment ago. Refresh and try again." },
        { status: 409 },
      );
    }
    ticket = created;
  } else {
    ticket = await prisma.supportTicket.create({ data: ticketData, select: { id: true, createdAt: true } });
  }

  const respondBy = organiserResponseDue(ticket);
  const data = {
    ticketId: ticket.id,
    athleteName: name,
    athleteEmail: ticketEmail,
    eventTitle: eventTitle || "An event",
    eventDate: event?.eventDate ?? eventDate ?? null,
    reason,
  };

  const sends: Promise<void>[] = [];
  if (requestType === "refund") {
    // The athlete hears that it arrived and what happens next.
    sends.push(sendRefundDecisionEmail(ticketEmail, {
      outcome: "requested",
      athleteName: entry?.athleteName ?? name,
      eventTitle: eventTitle || "your event",
      organiserName: event?.organiser.orgName ?? "The organiser",
      amountCents: quote?.cents ?? null,
      full: false,
      respondBy: event ? DUE_FORMAT.format(respondBy) : null,
      ticketId: ticket.id,
    }));
  }
  if (event) {
    const recipients = organiserNotificationRecipients(event.organiser);
    const eventUrl = organiserUrl(`/organiser/refunds`, SITE);
    for (const to of recipients) {
      sends.push(sendRefundRequestEmail(to, { ...data, eventUrl, audience: "organiser", respondBy }));
    }
  }
  const admins = await listAdminReviewRecipients().catch(() => []);
  const adminUrlForTicket = adminUrl("/admin/refunds", SITE);
  for (const to of admins) {
    sends.push(sendRefundRequestEmail(to, { ...data, eventUrl: adminUrlForTicket, audience: "admin", respondBy }));
  }
  await Promise.all(sends.map((p) => p.catch((err) => console.error("Refund request email failed:", err))));

  return NextResponse.json({ id: ticket.id });
}
