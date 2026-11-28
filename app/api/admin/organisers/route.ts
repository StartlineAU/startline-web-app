import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { isValidAbn } from "@/lib/abn";
import { issueClaimInvite } from "@/lib/organiser-claim";
import { inviteState, normaliseInviteEmail } from "@/lib/organiser-invites";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const organisers = await prisma.organiser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id:                       true,
        orgName:                  true,
        contactName:              true,
        email:                    true,
        phone:                    true,
        abn:                      true,
        status:                   true,
        verified:                 true,
        pendingClaim:             true,
        stripeOnboardingComplete: true,
        createdAt:                true,
        _count: {
          select: { events: true, reviews: true, registrations: true, members: true },
        },
        events: {
          where: {
            status: { in: ["APPROVED", "IN_PROGRESS"] },
            endsAtUtc: { gt: new Date() },
          },
          select: { id: true },
        },
        // The latest claim invitation, for an organisation an admin set up.
        invites: {
          where: { role: "OWNER", acceptedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { email: true, createdAt: true, expiresAt: true, acceptedAt: true },
        },
      },
    });

    const rows = organisers.map(({ events, _count, invites, ...o }) => {
      const invite = o.pendingClaim ? invites[0] : undefined;
      return {
        ...o,
        eventCount:        _count.events,
        liveEventCount:    events.length,
        reviewCount:       _count.reviews,
        registrationCount: _count.registrations,
        memberCount:       _count.members,
        claimInvite: invite
          ? { email: invite.email, sentAt: invite.createdAt, expiresAt: invite.expiresAt, state: inviteState(invite) }
          : null,
      };
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Admin organisers fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const createOrganiserSchema = z.object({
  orgName:      z.string().trim().min(1, "Organisation name is required.").max(200),
  // The address the claim invitation goes to, and the organisation's account
  // email until someone claims it.
  email:        z.string().trim().max(255).email("Enter a valid email for the organiser."),
  contactName:  optionalText(200),
  contactEmail: z.union([z.literal(""), z.string().trim().max(255).email("Enter a valid contact email.")]).optional().default(""),
  phone:        optionalText(50),
  bio:          optionalText(2000),
  abn:          optionalText(20),
  verified:     z.boolean().optional().default(true),
  sendInvite:   z.boolean().optional().default(false),
});

// POST /api/admin/organisers
// Creates an organisation for an organiser who is not on Startline yet, so an
// admin can list its events. Nobody is a member and it is marked pendingClaim;
// with sendInvite it also emails the organiser a link to claim it as Owner
// (lib/organiser-claim.ts). Verified by default: the admin is vouching for it,
// so events posted for it publish straight away.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = createOrganiserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const body = parsed.data;
  const email = normaliseInviteEmail(body.email);
  const abn = body.abn.replace(/\s/g, "");
  if (abn && !isValidAbn(abn)) {
    return NextResponse.json({ error: "That ABN is not valid. Check it, or leave it blank for the organiser to add." }, { status: 400 });
  }

  try {
    const taken = await prisma.organiser.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "An organisation already uses that email." }, { status: 409 });
    }

    const organiser = await prisma.organiser.create({
      data: {
        email,
        orgName:      body.orgName,
        contactName:  body.contactName || null,
        contactEmail: body.contactEmail || email,
        phone:        body.phone || null,
        bio:          body.bio || null,
        abn,
        verified:     body.verified,
        status:       "APPROVED",
        pendingClaim: true,
        photos:       [],
      },
      select: { id: true, orgName: true, email: true },
    });

    await writeAuditLog({
      adminId: session.sub,
      action: "CREATE_ORGANISER",
      targetType: "organiser",
      targetId: organiser.id,
      meta: { orgName: organiser.orgName, email, verified: body.verified },
    });

    let inviteUrl: string | null = null;
    if (body.sendInvite) {
      ({ inviteUrl } = await issueClaimInvite({
        organiserId: organiser.id,
        organisationName: organiser.orgName,
        email,
      }));
      await writeAuditLog({
        adminId: session.sub,
        action: "SEND_CLAIM_INVITE",
        targetType: "organiser",
        targetId: organiser.id,
        meta: { email },
      });
    }

    return NextResponse.json({ organiser, inviteUrl }, { status: 201 });
  } catch (err) {
    console.error("Admin organiser create error:", err);
    return NextResponse.json({ error: "Failed to create organisation." }, { status: 500 });
  }
}
