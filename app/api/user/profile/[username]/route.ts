import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getLevelProgress } from "@/lib/user-level";
import {
  registrationEventSelect,
  serializeRegistration,
  splitRegistrationsByDate,
} from "@/lib/user-registrations";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where:  { username },
    select: {
      id: true, name: true, username: true, bio: true,
      profilePicUrl: true, isPublic: true, points: true, level: true,
      registrations: {
        where: { status: "CONFIRMED" },
        select: registrationEventSelect,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (!user.isPublic) {
    return NextResponse.json({ error: "This profile is private." }, { status: 403 });
  }

  const serialized = user.registrations.map(serializeRegistration);
  const { upcoming, past } = splitRegistrationsByDate(serialized);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    username: user.username,
    bio: user.bio,
    profilePicUrl: user.profilePicUrl,
    isPublic: user.isPublic,
    gamification: getLevelProgress(user.points),
    registrations: { upcoming, past },
  });
}
