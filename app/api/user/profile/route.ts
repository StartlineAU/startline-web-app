import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { validateUsername } from "@/lib/username-validation";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: session.sub },
    select: {
      id: true, email: true, name: true, username: true,
      bio: true, profilePicUrl: true, isPublic: true,
      city: true, state: true,
      organiser: { select: { id: true, orgName: true, logoUrl: true, verified: true } },
    },
  });
  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const session = await getUserSession();
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

      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== session.sub) {
        return badRequest("This username is already taken.");
      }
    }
    data.username = username || null;
  }

  if ("bio" in body) data.bio = body.bio?.trim() || null;
  if ("profilePicUrl" in body) data.profilePicUrl = body.profilePicUrl || null;
  if ("isPublic" in body) data.isPublic = body.isPublic;
  if ("city" in body) data.city = body.city?.trim() || null;
  if ("state" in body) data.state = body.state?.trim() || null;

  const user = await prisma.user.update({
    where:  { id: session.sub },
    data,
    select: {
      id: true, email: true, name: true, username: true,
      bio: true, profilePicUrl: true, isPublic: true,
      city: true, state: true,
    },
  });
  return NextResponse.json(user);
}
