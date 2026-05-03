import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOrganiserSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const organiser = await prisma.organiser.findUnique({
      where:  { id: session.sub },
      select: {
        id: true, email: true, status: true, orgName: true, contactName: true,
        contactEmail: true, phone: true, abn: true, website: true, instagram: true,
        tiktok: true, facebook: true, eventTypes: true, bio: true, logoUrl: true,
        insuranceUrl: true, pastEventsUrl: true,
        certifications: true, emailOnApprove: true, emailOnReject: true,
      },
    });

    if (!organiser) {
      // Dev bypass: no real organiser in DB yet — return a placeholder
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json({
          id: session.sub, email: session.email, status: "APPROVED",
          orgName: null, contactName: null, contactEmail: null, phone: null, abn: null,
          website: null, instagram: null, tiktok: null, facebook: null, eventTypes: [], bio: null, logoUrl: null,
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
  if (!session) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ ok: true, status: "PENDING_PROFILE" });
    }
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const body = await req.json();
  const {
    orgName, contactName, contactEmail, phone, abn, website, instagram, tiktok, facebook, eventTypes,
    bio, logoUrl, insuranceUrl, pastEventsUrl, certifications,
    emailOnApprove, emailOnReject, submit,
  } = body;

  if (submit) {
    if (!orgName || !contactName || !phone || !contactEmail) {
      return NextResponse.json({ error: "Organisation name, contact details and phone are required." }, { status: 400 });
    }
  }

  const updated = await prisma.organiser.update({
    where: { id: session.sub },
    data: {
      orgName, contactName, contactEmail, phone, abn, website, instagram, tiktok, facebook, eventTypes,
      bio, logoUrl,
      emailOnApprove: emailOnApprove ?? true,
      emailOnReject:  emailOnReject  ?? true,
      ...(submit ? { status: "PENDING_REVIEW" } : {}),
    },
  });

  // Update the sl-status cookie so middleware reflects the new status immediately
  if (submit) {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    jar.set("sl-status", updated.status, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   60 * 60 * 24 * 7,
    });
  }

  return NextResponse.json({ ok: true, status: updated.status });
}
