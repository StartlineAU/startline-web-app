import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { idParams } from "@/lib/schemas";

// DELETE /api/organiser/members/invites/[id]
// Withdraws a pending invitation. Owner only, and only this organisation's.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  if (auth.session.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = idParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  try {
    const removed = await prisma.organiserInvite.deleteMany({
      where: { id: parsed.data.id, organiserId: auth.session.sub, acceptedAt: null },
    });
    if (removed.count === 0) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
