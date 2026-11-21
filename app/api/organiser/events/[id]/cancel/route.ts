import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { idParams } from "@/lib/schemas";
import { CancelError, cancelEvent, cancellationPreview } from "@/lib/event-cancellation";

const bodySchema = z.object({
  reason: z.string().max(1000).optional(),
});

async function ownedEvent(params: Promise<{ id: string }>) {
  const auth = await requireOrganiser();
  if (auth.error) return { error: auth.error };
  // Same rule as deleting: only an owner can call an event off.
  if (auth.session.role !== "OWNER") {
    return { error: NextResponse.json({ error: "Only an owner can cancel an event." }, { status: 403 }) };
  }
  const parsed = idParams.safeParse(await params);
  if (!parsed.success) return { error: NextResponse.json({ error: "Invalid id." }, { status: 400 }) };
  const event = await prisma.event.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, organiserId: true },
  });
  if (!event) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  if (event.organiserId !== auth.session.sub) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { event, session: auth.session };
}

// GET — what cancelling would refund, for the confirm dialog.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owned = await ownedEvent(params);
  if (owned.error) return owned.error;
  return NextResponse.json(await cancellationPreview(owned.event.id));
}

// POST — cancel the event. Every athlete is refunded everything they paid,
// booking fee included (lib/event-cancellation.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const owned = await ownedEvent(params);
  if (owned.error) return owned.error;

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  try {
    const summary = await cancelEvent({
      eventId: owned.event.id,
      actor: { role: "organiser", id: owned.session.sub },
      reason: body.data.reason ?? null,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    if (err instanceof CancelError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("Event cancel error:", err);
    return NextResponse.json({ error: "Failed to cancel event." }, { status: 500 });
  }
}
