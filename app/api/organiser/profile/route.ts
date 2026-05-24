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
        id: true, email: true, status: true,
        orgName: true, contactName: true, contactEmail: true, phone: true,
        abn: true, website: true, instagram: true, facebook: true,
        bio: true, logoUrl: true, coverImageUrl: true, coverPosition: true, photos: true,
      },
    });

    if (!organiser) {
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json({
          id: session.sub, email: session.email, status: "APPROVED",
          orgName: null, contactName: null, contactEmail: null, phone: null,
          abn: null, website: null, instagram: null, facebook: null, bio: null, logoUrl: null,
        });
      }
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json(organiser);
  } catch {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({
        id: session.sub, email: session.email, status: "APPROVED",
        orgName: null, contactName: null, contactEmail: null, phone: null,
        abn: null, website: null, instagram: null, facebook: null, bio: null, logoUrl: null,
      });
    }
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json();
  const { orgName, contactName, contactEmail, phone, abn, website, instagram, facebook, bio, logoUrl, coverImageUrl, coverPosition, photos } = body;

  if (!orgName || !contactName || !phone || !contactEmail) {
    return NextResponse.json(
      { error: "Organisation name, contact name, phone and contact email are required." },
      { status: 400 },
    );
  }

  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true") {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.organiser.update({
      where: { id: session.sub },
      data:  { orgName, contactName, contactEmail, phone, abn, website, instagram, facebook, bio, logoUrl, coverImageUrl, coverPosition, photos },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
