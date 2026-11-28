import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { idParams } from "@/lib/schemas";

// DELETE /api/organiser/blocked-athletes/[id]
// Lift a block. Owner only. The person can enter the organisation's events
// again; entries removed earlier stay removed.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only an Owner can change the blocked list." }, { status: 403 });
  }

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  try {
    const removed = await prisma.organiserBlock.deleteMany({
      where: { id: parsedParams.data.id, organiserId: session.sub },
    });
    if (removed.count === 0) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
