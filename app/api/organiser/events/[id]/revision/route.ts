import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";
import { discardPendingRevision, pendingRevision } from "@/lib/event-revision";

// GET — the edit waiting on this published event, if the organiser has one.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { organiserId: true },
  });
  if (!event || event.organiserId !== auth.session.sub) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ revision: await pendingRevision(id) });
}

// DELETE — drop the queued edit. The live listing was never changed.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { organiserId: true },
  });
  if (!event || event.organiserId !== auth.session.sub) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const discarded = await discardPendingRevision(id);
  if (!discarded) return NextResponse.json({ error: "No edit is waiting." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
