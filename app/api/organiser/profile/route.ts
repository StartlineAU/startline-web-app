import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { isValidAbn } from "@/lib/abn";
import { assetUrl } from "@/lib/asset-url";
import { parseTiers } from "@/lib/refund-policy";
import { saveOrganisationRefundPolicy } from "@/lib/organisation-refund-policy";

const organiserProfileSchema = z.object({
  orgName: z.string().max(200),
  contactName: z.string().max(200),
  contactEmail: z.string().trim().max(255).email("Enter a valid contact email."),
  phone: z.string().max(50),
  // Checked only when one is given: clearing it stays possible, and values
  // stored before the checksum existed are not re-validated until edited.
  abn: z
    .string()
    .max(20)
    .refine((value) => value.trim() === "" || isValidAbn(value), { message: "Enter a valid 11-digit ABN." })
    .nullable()
    .optional(),
  bio: z.string().max(5000).nullable().optional(),
  logoUrl: assetUrl().nullable().optional(),
  logoPosition: z.string().max(100).nullable().optional(),
  coverImageUrl: assetUrl().nullable().optional(),
  coverPosition: z.string().max(100).nullable().optional(),
  photos: z.array(assetUrl()).max(50).optional(),
  legalName: z.string().max(300).nullable().optional(),
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
  logoUrl:        assetUrl().nullable().optional(),
  logoPosition:   z.string().max(100).nullable().optional(),
  coverImageUrl:  assetUrl().nullable().optional(),
  coverPosition:  z.string().max(100).nullable().optional(),
  refundTiers:    z.array(z.object({
    daysBefore: z.number().int().min(0).max(3650),
    percent: z.number().int().min(0).max(100),
  })).max(20).optional(),
  refundPolicy:   z.string().max(2000).nullable().optional(),
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
        legalName: true, dob: true,
        stripeAccountId: true, stripeOnboardingComplete: true,
        notifyManagers: true,
        notifyEventApproved: true, notifyEventRejected: true, notifyNewRegistration: true,
        refundTiers: true, refundPolicy: true,
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
    legalName, dob,
  } = parsed.data;

  if (!orgName || !contactName || !phone || !contactEmail) {
    return NextResponse.json(
      { error: "Organisation name, contact name, phone and contact email are required." },
      { status: 400 },
    );
  }

  // Legal identity fields (ABN, legal name, DOB) are owner-level: they
  // underpin Stripe payouts and tax reporting. MANAGERs may edit the rest.
  const hasIdentityFields = abn !== undefined || legalName !== undefined ||
    dob !== undefined;
  if (hasIdentityFields && session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an Owner can update legal identity details." },
      { status: 403 },
    );
  }

  // Event review emails go to the contact address, so changing it decides who
  // hears from Startline on the organisation's behalf. Owner only, like the
  // other settings that decide who is told what.
  if (session.role !== "OWNER") {
    const current = await prisma.organiser.findUnique({
      where: { id: session.sub },
      select: { contactEmail: true },
    });
    if ((current?.contactEmail ?? "").toLowerCase() !== contactEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "Only an Owner can change the contact email." },
        { status: 403 },
      );
    }
  }

  try {
    await prisma.organiser.update({
      where: { id: session.sub },
      data: {
        orgName, contactName, contactEmail, phone,
        abn, bio,
        logoUrl, logoPosition, coverImageUrl, coverPosition, photos,
        ...(legalName !== undefined        ? { legalName }         : {}),
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

  const { notifyManagers, notifyEventApproved, notifyEventRejected, notifyNewRegistration, refundTiers, refundPolicy } = parsed.data;
  const changesNotifications = [notifyManagers, notifyEventApproved, notifyEventRejected, notifyNewRegistration]
    .some(v => v !== undefined);
  const changesRefundPolicy = refundTiers !== undefined || refundPolicy !== undefined;
  if ((changesNotifications || changesRefundPolicy) && session.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an Owner can change organisation settings." },
      { status: 403 },
    );
  }

  try {
    if (changesRefundPolicy) {
      const current = await prisma.organiser.findUnique({
        where: { id: session.sub },
        select: { refundTiers: true, refundPolicy: true },
      });
      await saveOrganisationRefundPolicy(
        session.sub,
        refundTiers ?? parseTiers(current?.refundTiers),
        refundPolicy !== undefined ? refundPolicy : (current?.refundPolicy ?? null),
      );
    }
    const { refundTiers: _tiers, refundPolicy: _notes, ...rest } = parsed.data;
    if (Object.keys(rest).length > 0) {
      await prisma.organiser.update({
        where: { id: session.sub },
        data: rest,
      });
    }
    return NextResponse.json({ ok: true, ...parsed.data });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
