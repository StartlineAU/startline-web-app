import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { rateLimit } from "@/lib/rate-limit";
import { canAddMember } from "@/lib/organiser-members";
import { hashInviteToken, inviteIsFor, inviteState } from "@/lib/organiser-invites";

const acceptSchema = z.object({ token: z.string().min(1).max(200) });

class InviteRaceError extends Error {}

// POST /api/organiser/invites/accept
// Body: { token }. Makes the signed-in account a MANAGER of the inviting
// organisation, if the invitation was sent to that account's address. The
// session's email is the account's verified address (lib/user-session.ts), so
// holding the link is not enough to join as someone else.
export async function POST(req: NextRequest) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Sign in to accept this invitation." }, { status: 401 });

  const blocked = await rateLimit(req, {
    prefix: "organiser-invite-accept",
    limit: 10,
    windowSeconds: 600,
    identifier: session.sub,
  });
  if (blocked) return blocked;

  const parsed = acceptSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "This invitation link is not valid." }, { status: 400 });

  const invite = await prisma.organiserInvite.findUnique({
    where: { tokenHash: hashInviteToken(parsed.data.token) },
    select: { id: true, organiserId: true, email: true, acceptedAt: true, expiresAt: true },
  });
  if (!invite) return NextResponse.json({ error: "This invitation link is not valid." }, { status: 404 });

  const state = inviteState(invite);
  if (state === "accepted") {
    return NextResponse.json({ error: "This invitation has already been accepted." }, { status: 410 });
  }
  if (state === "expired") {
    return NextResponse.json({ error: "This invitation has expired. Ask for a new one." }, { status: 410 });
  }
  if (!inviteIsFor(invite, session.email)) {
    return NextResponse.json(
      { error: `This invitation was sent to ${invite.email}. Sign in with that address to accept it.`, code: "WRONG_ACCOUNT" },
      { status: 403 },
    );
  }

  try {
    const [existing, membershipCount] = await Promise.all([
      prisma.organiserMember.findUnique({
        where: { organiserId_userId: { organiserId: invite.organiserId, userId: session.sub } },
        select: { id: true },
      }),
      prisma.organiserMember.count({ where: { userId: session.sub } }),
    ]);
    const check = canAddMember(Boolean(existing), membershipCount);
    if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      // Claim the invitation first, so two tabs accepting at once make one
      // membership.
      const claimed = await tx.organiserInvite.updateMany({
        where: { id: invite.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new InviteRaceError();
      await tx.organiserMember.create({
        data: { organiserId: invite.organiserId, userId: session.sub, role: "MANAGER" },
      });
    });

    return NextResponse.json({ ok: true, organiserId: invite.organiserId });
  } catch (err) {
    if (err instanceof InviteRaceError) {
      return NextResponse.json({ error: "This invitation has already been accepted." }, { status: 410 });
    }
    console.error("Accept invitation error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
