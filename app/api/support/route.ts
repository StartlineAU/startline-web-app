import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { rateLimit } from "@/lib/rate-limit";
import { assertTurnstile } from "@/lib/turnstile";
import { refundWithinCutoff } from "@/lib/refund-policy";
import { adminUrl, organiserUrl } from "@/lib/portal-domains";
import { listAdminReviewRecipients } from "@/lib/admin-notification-recipients";
import { organiserNotificationRecipients } from "@/lib/organiser-notification-recipients";
import { sendRefundRequestEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  requestType: z.enum(["refund", "other"]),
  eventName: z.string().trim().max(200).optional(),
  eventDate: z.string().trim().max(20).optional(),
  eventId: z.string().trim().max(80).optional(),
  reason: z.string().trim().min(1).max(5000),
  turnstileToken: z.string().max(4000).optional(),
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  const blocked = await rateLimit(request, { prefix: "support", limit: 3, windowSeconds: 60 });
  if (blocked) return blocked;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill out the required fields." }, { status: 400 });
  }
  const botBlocked = await assertTurnstile(request, parsed.data, "support");
  if (botBlocked) return botBlocked;

  const { name, email, requestType, eventName, eventDate, eventId, reason } = parsed.data;
  const session = await getUserSession().catch(() => null);

  // Resolve the event when the athlete picked one, so the right organisation sees it.
  const event = eventId
    ? await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true, title: true, eventDate: true, startsAtUtc: true, organiserId: true,
          organiser: {
            select: {
              email: true, contactEmail: true, notifyManagers: true,
              members: { select: { role: true, user: { select: { email: true } } } },
            },
          },
        },
      })
    : null;

  if (requestType === "refund") {
    let startsAt: Date | null = event?.startsAtUtc ?? null;
    if (!startsAt && eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      startsAt = new Date(`${eventDate}T00:00:00Z`);
    }
    if (refundWithinCutoff(startsAt)) {
      return NextResponse.json(
        { error: "Refund requests are not available within 24 hours of the event start." },
        { status: 409 },
      );
    }
  }

  const eventTitle = event?.title ?? eventName ?? "";
  const ticket = await prisma.supportTicket.create({
    data: {
      name,
      email,
      userId: session?.sub ?? null,
      requestType,
      eventName: eventTitle || null,
      eventDate: event?.eventDate ?? eventDate ?? null,
      eventId: event?.id ?? null,
      organiserId: event?.organiserId ?? null,
      reason,
    },
    select: { id: true },
  });

  const data = {
    ticketId: ticket.id,
    athleteName: name,
    athleteEmail: email,
    eventTitle: eventTitle || "An event",
    eventDate: event?.eventDate ?? eventDate ?? null,
    reason,
  };

  const sends: Promise<void>[] = [];
  if (event) {
    const recipients = organiserNotificationRecipients(event.organiser);
    const eventUrl = organiserUrl(`/organiser/refunds`, SITE);
    for (const to of recipients) {
      sends.push(sendRefundRequestEmail(to, { ...data, eventUrl }));
    }
  }
  const admins = await listAdminReviewRecipients().catch(() => []);
  const adminUrlForTicket = adminUrl("/admin/refunds", SITE);
  for (const to of admins) {
    sends.push(sendRefundRequestEmail(to, { ...data, eventUrl: adminUrlForTicket }));
  }
  await Promise.all(sends.map((p) => p.catch((err) => console.error("Refund request email failed:", err))));

  return NextResponse.json({ id: ticket.id });
}
