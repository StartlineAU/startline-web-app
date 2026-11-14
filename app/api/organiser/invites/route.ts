import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { rateLimit } from "@/lib/rate-limit";
import { hashInviteToken, inviteIsFor, inviteState } from "@/lib/organiser-invites";

// GET /api/organiser/invites?token=...
// What the invitation page shows: which organisation, which address it is for,
// and whether the signed-in account (if any) is that address. Answers only for
// a real token, so it reveals nothing to someone without the link.
export async function GET(req: NextRequest) {
  const blocked = await rateLimit(req, { prefix: "organiser-invite-view", limit: 30, windowSeconds: 600 });
  if (blocked) return blocked;

  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token || token.length > 200) {
    return NextResponse.json({ error: "This invitation link is not valid." }, { status: 404 });
  }

  const invite = await prisma.organiserInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      email: true, acceptedAt: true, expiresAt: true,
      organiser: { select: { orgName: true } },
    },
  });
  if (!invite) {
    return NextResponse.json({ error: "This invitation link is not valid." }, { status: 404 });
  }

  const session = await getUserSession();
  return NextResponse.json({
    organisationName: invite.organiser.orgName ?? "An organisation",
    email: invite.email,
    state: inviteState(invite),
    signedIn: Boolean(session),
    signedInAsInvitee: session ? inviteIsFor(invite, session.email) : false,
  });
}
