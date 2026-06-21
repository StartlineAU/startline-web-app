import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerSession } from "@/lib/amplify-server";
import { validateUsername } from "@/lib/username-validation";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where:  { id: session.sub },
    select: {
      id: true, email: true, name: true, username: true,
      bio: true, profilePicUrl: true, isPublic: true,
      organiser: { select: { id: true, orgName: true, logoUrl: true, verified: true } },
    },
  });
  return NextResponse.json(customer);
}

export async function PUT(req: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if ("name" in body) data.name = body.name?.trim() || null;

  if ("username" in body) {
    const username = body.username?.trim()?.toLowerCase();
    if (username) {
      const validation = validateUsername(username);
      if (!validation.valid) return badRequest(validation.reason);

      const existing = await prisma.customer.findUnique({ where: { username } });
      if (existing && existing.id !== session.sub) {
        return badRequest("This username is already taken.");
      }
    }
    data.username = username || null;
  }

  if ("bio" in body) data.bio = body.bio?.trim() || null;
  if ("profilePicUrl" in body) data.profilePicUrl = body.profilePicUrl || null;
  if ("isPublic" in body) data.isPublic = body.isPublic;

  const customer = await prisma.customer.update({
    where:  { id: session.sub },
    data,
    select: {
      id: true, email: true, name: true, username: true,
      bio: true, profilePicUrl: true, isPublic: true,
    },
  });
  return NextResponse.json(customer);
}
