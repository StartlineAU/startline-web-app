import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOrganiserSession } from "@/lib/amplify-server";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getOrganiserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const reviews = await prisma.review.findMany({
      where:   { organiserId: session.sub, isPublished: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, overallRating: true, communicationRating: true,
        organisationRating: true, experienceRating: true,
        title: true, body: true, reviewerName: true,
        eventTitle: true, isVerified: true, createdAt: true,
      },
    });
    return NextResponse.json(reviews);
  } catch {
    return NextResponse.json([]);
  }
}
