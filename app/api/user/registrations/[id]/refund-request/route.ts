import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { entryPaidCents } from "@/lib/stripe-refunds";

// POST — cancel a FREE entry from the athlete's own account.
//
// A paid entry is not refunded from here. Refunds are raised through Support
// (`/support`), reviewed by the organiser and Startline, and issued by staff.
// Idempotent, so a double click (or a jumpy connection) never errors.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  const { id } = parsedParams.data;

  const registration = await prisma.registration.findUnique({
    where: { id },
    select: {
      id: true, userId: true, athleteEmail: true, athleteName: true, status: true,
      amountCents: true, platformFeeCents: true, feeStructure: true, refundAmountCents: true,
      event: {
        select: {
          id: true, title: true, eventDate: true,
          organiser: { select: { id: true } },
        },
      },
    },
  });

  // Scope strictly to the caller's own entry — by user link or matching email.
  const isOwner =
    !!registration &&
    (registration.userId === session.sub ||
      registration.athleteEmail.toLowerCase() === session.email.toLowerCase());
  if (!registration || !isOwner) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  if (registration.status === "REFUND_REQUESTED") {
    return NextResponse.json({ status: registration.status, alreadyRequested: true });
  }
  if (registration.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "Only a confirmed registration can be cancelled." },
      { status: 409 },
    );
  }

  // A paid entry goes through Support. Only a free entry is cancelled here.
  const paidCents = entryPaidCents(registration);
  if (paidCents > 0) {
    return NextResponse.json(
      { error: "Ask for a refund through Support. A paid entry cannot be refunded from here." },
      { status: 409 },
    );
  }

  // Once the race has been run there is nothing to cancel — the spot was used.
  const today = new Date().toISOString().slice(0, 10);
  if (registration.event.eventDate < today) {
    return NextResponse.json(
      { error: "This event has already taken place." },
      { status: 409 },
    );
  }

  await prisma.registration.update({
    where: { id },
    data: {
      status: "REFUND_REQUESTED",
      refundRequestedAt: new Date(),
      refundPercent: 0,
      refundAmountCents: 0,
      refundOutsidePolicy: false,
    },
  });

  // Tell every member of the organiser in-app. Best-effort: the cancellation flag
  // is what matters, so a notification failure must never fail the request.
  try {
    const memberIds = await prisma.organiserMember.findMany({
      where: { organiserId: registration.event.organiser.id },
      select: { userId: true },
    });
    await prisma.userNotification.createMany({
      data: memberIds.map((m) => ({
        userId: m.userId,
        type: "ORGANISER_REFUND_REQUEST" as const,
        title: "Entry cancelled",
        body:
          `${registration.athleteName} cancelled their free entry to ${registration.event.title}. ` +
          `They have left wave assignment and freed their spot. There is nothing to refund.`,
        eventId: registration.event.id,
      })),
    });
  } catch {
    // Swallowed on purpose — see above.
  }

  return NextResponse.json({ status: "REFUND_REQUESTED", refundPercent: 0, refundAmountCents: 0 });
}
