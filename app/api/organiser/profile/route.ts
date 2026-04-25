import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOrganiserSession, signToken, setOrganiserCookie } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const organiser = await prisma.organiser.findUnique({
      where:  { id: session.sub },
      select: {
        id: true, email: true, status: true, orgName: true, contactName: true,
        phone: true, abn: true, website: true, instagram: true, facebook: true,
        bio: true, logoUrl: true, insuranceUrl: true, pastEventsUrl: true,
        certifications: true, emailOnApprove: true, emailOnReject: true,
      },
    });

    if (!organiser) {
      // Dev bypass: no real organiser in DB yet — return a placeholder
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json({
          id: session.sub, email: session.email, status: "APPROVED",
          orgName: null, contactName: null, phone: null, abn: null,
          website: null, instagram: null, facebook: null, bio: null, logoUrl: null,
          insuranceUrl: null, pastEventsUrl: null, certifications: null,
          emailOnApprove: true, emailOnReject: true,
        });
      }
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json(organiser);
  } catch {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({
        id: session.sub, email: session.email, status: "APPROVED",
        orgName: null, contactName: null, phone: null, abn: null,
        website: null, instagram: null, facebook: null, bio: null, logoUrl: null,
        insuranceUrl: null, pastEventsUrl: null, certifications: null,
        emailOnApprove: true, emailOnReject: true,
      });
    }
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json();
  const {
    orgName, contactName, phone, abn, website, instagram, facebook,
    bio, logoUrl, insuranceUrl, pastEventsUrl, certifications,
    emailOnApprove, emailOnReject, submit,
  } = body;

  // Strict stage-3 validation when submitting for review
  if (submit) {
    if (!orgName || !contactName || !phone) {
      return NextResponse.json({ error: "Organisation name, contact name and phone are required." }, { status: 400 });
    }
    if (!insuranceUrl) {
      return NextResponse.json({ error: "Public liability insurance document link is required." }, { status: 400 });
    }
    if (!pastEventsUrl) {
      return NextResponse.json({ error: "Evidence of past events is required." }, { status: 400 });
    }
  }

  const updated = await prisma.organiser.update({
    where: { id: session.sub },
    data: {
      orgName, contactName, phone, abn, website, instagram, facebook,
      bio, logoUrl, insuranceUrl, pastEventsUrl, certifications,
      emailOnApprove: emailOnApprove ?? true,
      emailOnReject:  emailOnReject  ?? true,
      ...(submit ? { status: "PENDING_REVIEW" } : {}),
    },
  });

  // Reissue token with updated status so middleware reflects the change
  if (submit) {
    const jwt = await signToken({
      sub:    updated.id,
      role:   "organiser",
      email:  updated.email,
      status: updated.status,
    });
    await setOrganiserCookie(jwt);
  }

  return NextResponse.json({ ok: true, status: updated.status });
}
