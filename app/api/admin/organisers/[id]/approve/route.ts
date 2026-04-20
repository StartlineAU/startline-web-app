import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { sendApprovalEmail } from "@/lib/email";

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const { notes } = await req.json().catch(() => ({ notes: undefined }));

  const organiser = await prisma.organiser.update({
    where: { id },
    data:  {
      status:      "APPROVED",
      adminNotes:  notes ?? null,
      reviewedById: session.sub,
      reviewedAt:  new Date(),
    },
  });

  if (organiser.emailOnApprove) {
    await sendApprovalEmail(organiser.email, organiser.orgName ?? organiser.email);
  }

  return NextResponse.json({ ok: true });
}
