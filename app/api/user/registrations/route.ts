import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import {
  registrationEventSelect,
  serializeRegistration,
  splitRegistrationsByDate,
} from "@/lib/user-registrations";

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const registrations = await prisma.registration.findMany({
    where: {
      userId: session.sub,
      status: "CONFIRMED",
    },
    select: registrationEventSelect,
    orderBy: { createdAt: "desc" },
  });

  const serialized = registrations.map(serializeRegistration);
  const { upcoming, past } = splitRegistrationsByDate(serialized);

  return NextResponse.json({ upcoming, past, total: serialized.length });
}
