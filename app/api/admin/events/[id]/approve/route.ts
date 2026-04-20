import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { sendEventApprovedEmail } from "@/lib/email";

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const { notes } = await req.json().catch(() => ({ notes: undefined }));

  const event = await prisma.event.update({
    where:   { id },
    data:    { status: "APPROVED", adminNotes: notes ?? null, reviewedById: session.sub, reviewedAt: new Date() },
    include: { organiser: { select: { email: true, emailOnApprove: true } } },
  });

  if (event.organiser.emailOnApprove) {
    await sendEventApprovedEmail(event.organiser.email, event.title);
  }

  return NextResponse.json({ ok: true });
}
