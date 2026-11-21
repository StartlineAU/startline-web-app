import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { writeAuditLog } from "@/lib/audit";
import {
  CancelError,
  cancelEvent,
  cancellationPreview,
} from "@/lib/event-cancellation";

const bodySchema = z.object({
  reason: z.string().max(1000).optional(),
});

// GET — what cancelling would refund, and for a cancelled event, how its
// refunds are going (each entry's state and any failure).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const parsed = idParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const [preview, refunds] = await Promise.all([
    cancellationPreview(parsed.data.id),
    prisma.registration.findMany({
      where: { eventId: parsed.data.id, cancelRefundStatus: { not: null } },
      select: {
        id: true, athleteName: true, athleteEmail: true, cancelRefundStatus: true,
        cancelRefundError: true, refundAmountCents: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return NextResponse.json({ ...preview, refunds });
}

// POST — cancel the event and refund everyone in full. On an event that is
// already cancelled this retries any refund still outstanding.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const parsed = idParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  try {
    const summary = await cancelEvent({
      eventId: parsed.data.id,
      actor: { role: "admin", id: session.sub },
      reason: body.data.reason ?? null,
    });
    const event = await prisma.event.findUnique({ where: { id: parsed.data.id }, select: { title: true } });
    await writeAuditLog({
      adminId: session.sub,
      action: summary.alreadyCancelled ? "RETRY_CANCELLATION_REFUNDS" : "CANCEL_EVENT",
      targetType: "event",
      targetId: parsed.data.id,
      meta: {
        title: event?.title,
        ...(body.data.reason ? { reason: body.data.reason } : {}),
        refunded: summary.refunded,
        failed: summary.failed,
        refundedCents: summary.refundedCents,
      },
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    if (err instanceof CancelError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("Admin event cancel error:", err);
    return NextResponse.json({ error: "Failed to cancel event." }, { status: 500 });
  }
}
