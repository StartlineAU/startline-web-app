import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { organiserUrl } from "@/lib/portal-domains";
import { sendOrganiserInviteEmail } from "@/lib/email";
import {
  INVITE_TTL_DAYS,
  inviteExpiry,
  newInviteToken,
  normaliseInviteEmail,
} from "@/lib/organiser-invites";
import { z } from "zod";

const addMemberSchema = z.object({ email: z.string().trim().max(254).email() });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// GET /api/organiser/members
// Lists all members of the active organiser.
export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const members = await prisma.organiserMember.findMany({
      where:  { organiserId: session.sub },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const userSession = await getUserSession();
    const currentMember = userSession
      ? await prisma.organiserMember.findFirst({
          where: { organiserId: session.sub, userId: userSession.sub },
          select: { id: true },
        })
      : null;

    // Invitations still waiting for an answer. Accepted and expired ones are
    // history, not roster.
    const invites = await prisma.organiserInvite.findMany({
      where: { organiserId: session.sub, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, createdAt: true, expiresAt: true },
    });

    return NextResponse.json({
      members,
      invites,
      role: session.role,
      currentMemberId: currentMember?.id ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// POST /api/organiser/members
// Body: { email }. Owner only. Sends an invitation to join as a MANAGER; the
// person becomes a member only when they accept it, signed in with that
// address (POST /api/organiser/invites/accept).
//
// The answer is the same whether or not the address has an account, so this
// cannot be used to find out who is on Startline. The invite link comes back
// too, so the Owner can pass it on themselves: it is useless to anyone who is
// not signed in as the invited address.
export async function POST(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = addMemberSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = normaliseInviteEmail(parsed.data.email);

  // Each invitation sends an email from Startline, so the organisation's rate
  // is capped as well as the caller's.
  const blocked = await rateLimit(req, {
    prefix: "organiser-invite",
    limit: 30,
    windowSeconds: 24 * 60 * 60,
    identifier: session.sub,
    failClosed: true,
  });
  if (blocked) return blocked;

  try {
    const alreadyMember = await prisma.organiserMember.findFirst({
      where: { organiserId: session.sub, user: { email: { equals: email, mode: "insensitive" } } },
      select: { id: true },
    });
    if (alreadyMember) {
      return NextResponse.json({ error: "That person is already a member." }, { status: 409 });
    }

    const inviter = await getUserSession();
    const organisation = await prisma.organiser.findUnique({
      where: { id: session.sub },
      select: { orgName: true },
    });
    const { token, tokenHash } = newInviteToken();

    // A new invitation replaces any earlier one for the same address, so only
    // the latest link works.
    const invite = await prisma.$transaction(async (tx) => {
      await tx.organiserInvite.deleteMany({
        where: { organiserId: session.sub, email, acceptedAt: null },
      });
      return tx.organiserInvite.create({
        data: {
          organiserId: session.sub,
          email,
          tokenHash,
          invitedById: inviter?.sub ?? null,
          expiresAt: inviteExpiry(),
        },
        select: { id: true, email: true, createdAt: true, expiresAt: true },
      });
    });

    const inviteUrl = organiserUrl(`/organiser/invite?token=${encodeURIComponent(token)}`, SITE);
    await sendOrganiserInviteEmail(email, {
      organisationName: organisation?.orgName || "An organisation",
      inviteUrl,
      expiresInDays: INVITE_TTL_DAYS,
    }).catch((err: unknown) => console.error("Organiser invite email failed:", err));

    return NextResponse.json({ invite, inviteUrl }, { status: 201 });
  } catch (err) {
    console.error("Organiser invite error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
