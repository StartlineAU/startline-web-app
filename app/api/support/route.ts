import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { assertTurnstile } from "@/lib/turnstile";
import { refundWithinCutoff } from "@/lib/refund-policy";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

  const { name, email, requestType, eventName, eventDate, eventId, reason } = parsed.data;

  if (requestType === "refund") {
    let startsAt: Date | null = null;
    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { startsAtUtc: true },
      });
      startsAt = event?.startsAtUtc ?? null;
    } else if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      startsAt = new Date(`${eventDate}T00:00:00Z`);
    }
    if (refundWithinCutoff(startsAt)) {
      return NextResponse.json(
        { error: "Refunds are not available within 24 hours of the event start." },
        { status: 409 },
      );
    }
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      name,
      email,
      requestType,
      eventName: eventName || null,
      eventDate: eventDate || null,
      eventId: eventId || null,
      reason,
    },
    select: { id: true },
  });

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (resend) {
    await resend.emails.send({
      from: process.env.RESEND_FROM?.trim() || "Startline <events@startlineau.com>",
      to: "admin@startlineau.com",
      replyTo: email,
      subject: `[Support ${ticket.id.slice(0, 8)}] ${requestType === "refund" ? "Refund request" : "Support request"}`,
      html: `
        <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) opened a ${escapeHtml(requestType)} ticket.</p>
        <p>Event: ${escapeHtml(eventName || "Not given")}${eventDate ? ` · ${escapeHtml(eventDate)}` : ""}</p>
        <p>${escapeHtml(reason)}</p>
        <p>Ticket ${escapeHtml(ticket.id)}</p>
      `,
    }).catch((err) => console.error("Support ticket email failed:", err));
  }

  return NextResponse.json({ id: ticket.id });
}
