import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { rateLimit } from "@/lib/rate-limit";
import { issueClaimInvite, setupEmailConflict } from "@/lib/organiser-claim";
import { z } from "zod";

const setupSchema = z.object({
  orgName: z.string().max(200),
  contactName: z.string().max(200),
  contactEmail: z.string().trim().max(255).email("Enter a valid contact email."),
  phone: z.string().max(50),
});

export async function POST(req: NextRequest) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const parsed = setupSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Organisation name and contact details are required." },
      { status: 400 },
    );
  }
  const { orgName, contactName, contactEmail, phone } = parsed.data;
  if (!orgName.trim()) {
    return NextResponse.json({ error: "Organisation name is required." }, { status: 400 });
  }
  if (!contactName.trim() || !contactEmail.trim()) {
    return NextResponse.json({ error: "Contact name and contact email are required." }, { status: 400 });
  }

  const existing = await prisma.organiserMember.findFirst({
    where: { userId: session.sub },
    select: { organiser: { select: { id: true, orgName: true } } },
  });
  if (existing) {
    return NextResponse.json(existing.organiser);
  }

  // An organisation's email is unique. If Startline already set one up under
  // this address, creating a second would fail; offer the claim link instead.
  // The session email is the account's verified address, so sending the link
  // there hands it to nobody new.
  const sameEmail = await prisma.organiser.findFirst({
    where: { email: { equals: session.email, mode: "insensitive" } },
    select: { id: true, orgName: true, pendingClaim: true },
  });
  const conflict = setupEmailConflict(sameEmail);
  if (conflict === "claim" && sameEmail) {
    // Each call sends an email, so cap how often one account can ask.
    const blocked = await rateLimit(req, {
      prefix: "organiser-setup-claim",
      limit: 3,
      windowSeconds: 3600,
      identifier: session.sub,
    });
    if (blocked) return blocked;
    await issueClaimInvite({ organiserId: sameEmail.id, organisationName: sameEmail.orgName, email: session.email });
    return NextResponse.json(
      {
        error: `${sameEmail.orgName || "Your organisation"} is already on Startline. We've emailed ${session.email} a link to claim it.`,
        code: "CLAIM_AVAILABLE",
      },
      { status: 409 },
    );
  }
  if (conflict === "taken") {
    return NextResponse.json(
      { error: "An organisation already uses this account's email. Ask its Owner to invite you instead.", code: "EMAIL_IN_USE" },
      { status: 409 },
    );
  }

  try {
    const organiser = await prisma.$transaction(async (tx) => {
      const org = await tx.organiser.create({
        data: {
          createdBy: session.sub,
          email: session.email,
          orgName: orgName.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          phone: phone.trim(),
          verified: false,
          status: "APPROVED",
          abn: "",
          photos: [],
        },
        select: { id: true, orgName: true },
      });

      await tx.organiserMember.create({
        data: {
          organiserId: org.id,
          userId: session.sub,
          role: "OWNER",
        },
      });

      return org;
    });

    return NextResponse.json(organiser);
  } catch (err) {
    console.error("Organiser setup error:", err);
    return NextResponse.json({ error: "Failed to create organiser profile." }, { status: 500 });
  }
}
