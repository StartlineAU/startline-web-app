import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getOrganiserRatings } from "@/lib/reviews";
import {
  PROFILE_HISTORY_EVENT_SELECT, countCompletedRaces, profileHistoryWhere, withRacePhase,
} from "@/lib/profile-history";
import { usernameParams } from "@/lib/schemas";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const parsedParams = usernameParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }
  const { username } = parsedParams.data;
  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      bio: true,
      profilePicUrl: true,
      isPublic: true,
      city: true,
      state: true,
      createdAt: true,
      // Finds entries others bought for this person. Never returned.
      email: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (!user.isPublic) {
    return NextResponse.json({ error: "This profile is private." }, { status: 403 });
  }

  const registrations = await prisma.registration.findMany({
    where: profileHistoryWhere(user),
    orderBy: { event: { eventDate: "asc" } },
    select: {
      id: true,
      resultTime: true,
      resultPlacement: true,
      event: { select: PROFILE_HISTORY_EVENT_SELECT },
    },
  });
  const history = withRacePhase(registrations);

  const ratings = await getOrganiserRatings(
    registrations.map((r) => r.event.organiser.id),
  );
  const historyRegistrations = history.map((r) => ({
    ...r,
    event: {
      ...r.event,
      organiser: {
        ...r.event.organiser,
        rating: ratings.get(r.event.organiser.id) ?? null,
      },
    },
  }));

  const { email: _email, ...publicUser } = user;
  return NextResponse.json({
    ...publicUser,
    history: {
      completed: countCompletedRaces(history),
      registrations: historyRegistrations,
    },
  });
}
