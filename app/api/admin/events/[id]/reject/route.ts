import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { sendEventRejectedEmail } from "@/lib/email";

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const { reason, notes } = await req.json().catch(() => ({ reason: undefined, notes: undefined }));

  const event = await prisma.event.update({
    where:   { id },
    data:    {
      status: "REJECTED", rejectionReason: reason ?? null,
      adminNotes: notes ?? null, reviewedById: session.sub, reviewedAt: new Date(),
    },
    include: { organiser: { select: { email: true, emailOnReject: true } } },
  });

  if (event.organiser.emailOnReject) {
    await sendEventRejectedEmail(event.organiser.email, event.title, reason);
  }

  return NextResponse.json({ ok: true });
}
