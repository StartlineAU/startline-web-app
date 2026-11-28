import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";
import { issueClaimInvite } from "@/lib/organiser-claim";

// Optional: send it to another address than the organisation's account email,
// for when the person who will own it signs in with a different one.
const bodySchema = z.object({
  email: z.string().trim().max(255).email("Enter a valid email.").optional(),
});

// POST /api/admin/organisers/[id]/claim-invite
// Emails a link to claim an admin-created organisation as Owner. Sending again
// withdraws the earlier link. Refused once the organisation has been claimed.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  try {
    const organiser = await prisma.organiser.findUnique({
      where: { id },
      select: { id: true, orgName: true, email: true, pendingClaim: true },
    });
    if (!organiser) return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
    if (!organiser.pendingClaim) {
      return NextResponse.json({ error: "This organisation already has an Owner." }, { status: 409 });
    }

    const email = parsed.data.email ?? organiser.email;
    const { invite, inviteUrl } = await issueClaimInvite({
      organiserId: organiser.id,
      organisationName: organiser.orgName,
      email,
    });

    await writeAuditLog({
      adminId: session.sub,
      action: "SEND_CLAIM_INVITE",
      targetType: "organiser",
      targetId: organiser.id,
      meta: { email: invite.email },
    });

    return NextResponse.json({ invite, inviteUrl }, { status: 201 });
  } catch (err) {
    console.error("Admin claim invite error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
