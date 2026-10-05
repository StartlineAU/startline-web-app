import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const organiserProfileSchema = z.object({
  orgName: z.string().max(200),
  contactName: z.string().max(200),
  contactEmail: z.string().max(255),
  phone: z.string().max(50),
  abn: z.string().max(20).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  logoUrl: z.string().max(3000).nullable().optional(),
  logoPosition: z.string().max(100).nullable().optional(),
  coverImageUrl: z.string().max(3000).nullable().optional(),
  coverPosition: z.string().max(100).nullable().optional(),
  photos: z.array(z.string().max(3000)).optional(),
  legalName: z.string().max(300).nullable().optional(),
  insuranceDeclared: z.boolean().optional(),
  dob: z.string().max(20).nullable().optional(),
});

// One setting at a time. The images are here so that uploading a logo or
// dragging a cover into place saves that image alone: sending them through PUT
// took the whole form with it and committed whatever was half typed.
const settingsPatchSchema = z.object({
  notifyManagers:        z.boolean().optional(),
  notifyEventApproved:   z.boolean().optional(),
  notifyEventRejected:   z.boolean().optional(),
  notifyNewRegistration: z.boolean().optional(),
  logoUrl:        z.string().max(3000).nullable().optional(),
  logoPosition:   z.string().max(100).nullable().optional(),
  coverImageUrl:  z.string().max(3000).nullable().optional(),
  coverPosition:  z.string().max(100).nullable().optional(),
}).strict().refine(v => Object.keys(v).length > 0);

export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const organiser = await prisma.organiser.findUnique({
      where:  { id: session.sub },
      select: {
        id: true, email: true, status: true,
        orgName: true, contactName: true, contactEmail: true, phone: true,
        abn: true,
        bio: true, logoUrl: true, logoPosition: true, coverImageUrl: true, coverPosition: true, photos: true,
        legalName: true, insuranceDeclared: true, dob: true,
        stripeAccountId: true, stripeOnboardingComplete: true,
        notifyManagers: true,
        notifyEventApproved: true, notifyEventRejected: true, notifyNewRegistration: true,
        _count: { select: { follows: true } },
      },
    });

    if (!organiser) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { _count, ...rest } = organiser;
    // `role` is the caller's own, so the settings UI knows whether to offer
    // owner-only controls. The server still enforces them.
    return NextResponse.json({ ...rest, followerCount: _count.follows, role: session.role });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = organiserProfileSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const {
    orgName, contactName, contactEmail, phone,
    abn, bio,
    logoUrl, logoPosition, coverImageUrl, coverPosition, photos,
    legalName, insuranceDeclared, dob,
  } = parsed.data;

  if (!orgName || !contactName || !phone || !contactEmail) {
    return NextResponse.json(
      { error: "Organisation name, contact name, phone and contact email are required." },
      { status: 400 },
    );
  }

  // Legal identity fields (ABN, legal name, DOB, insurance) are owner-level:
  // they underpin Stripe payouts and liability. MANAGERs may edit the rest.
  const hasIdentityFields = abn !== undefined || legalName !== undefined ||
    dob !== undefined || insuranceDeclared !== undefined;
  if (hasIdentityFields && session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an Owner can update legal identity details." },
      { status: 403 },
    );
  }

  try {
    await prisma.organiser.update({
      where: { id: session.sub },
      data: {
        orgName, contactName, contactEmail, phone,
        abn, bio,
        logoUrl, logoPosition, coverImageUrl, coverPosition, photos,
        ...(legalName !== undefined        ? { legalName }         : {}),
        ...(insuranceDeclared !== undefined ? { insuranceDeclared } : {}),
        ...(dob !== undefined         ? { dob }              : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/organiser/profile
// Body: any of the notification switches (notifyManagers, notifyEventApproved,
// notifyEventRejected, notifyNewRegistration) and the images (logoUrl,
// logoPosition, coverImageUrl, coverPosition). The notification switches are
// owner only: they decide what the whole organisation is told, so a manager
// cannot change them. The images follow PUT, which a manager may also use.
export async function PATCH(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = settingsPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const { notifyManagers, notifyEventApproved, notifyEventRejected, notifyNewRegistration } = parsed.data;
  const changesNotifications = [notifyManagers, notifyEventApproved, notifyEventRejected, notifyNewRegistration]
    .some(v => v !== undefined);
  if (changesNotifications && session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an Owner can change who receives notifications." },
      { status: 403 },
    );
  }

  try {
    await prisma.organiser.update({
      where: { id: session.sub },
      data:  parsed.data,
    });
    return NextResponse.json({ ok: true, ...parsed.data });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
