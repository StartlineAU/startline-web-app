import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ organiserId: string }> },
) {
  const { organiserId } = await params;

  try {
    const reviews = await prisma.review.findMany({
      where:   { organiserId, isPublished: true },
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ organiserId: string }> },
) {
  const { organiserId } = await params;

  const body = await req.json();
  const {
    overallRating, communicationRating, organisationRating, experienceRating,
    title, body: reviewBody, reviewerName, eventTitle,
  } = body;

  if (!overallRating || overallRating < 1 || overallRating > 5)
    return NextResponse.json({ error: "A rating between 1 and 5 is required." }, { status: 400 });
  if (!title?.trim())
    return NextResponse.json({ error: "Review title is required." }, { status: 400 });
  if (!reviewBody?.trim())
    return NextResponse.json({ error: "Review body is required." }, { status: 400 });
  if (!reviewerName?.trim())
    return NextResponse.json({ error: "Your name is required." }, { status: 400 });

  try {
    const organiser = await prisma.organiser.findUnique({ where: { id: organiserId } });
    if (!organiser) return NextResponse.json({ error: "Organiser not found." }, { status: 404 });

    const review = await prisma.review.create({
      data: {
        organiserId,
        overallRating:       Math.min(5, Math.max(1, Number(overallRating))),
        communicationRating: communicationRating ? Math.min(5, Math.max(1, Number(communicationRating))) : null,
        organisationRating:  organisationRating  ? Math.min(5, Math.max(1, Number(organisationRating)))  : null,
        experienceRating:    experienceRating    ? Math.min(5, Math.max(1, Number(experienceRating)))    : null,
        title:       title.trim(),
        body:        reviewBody.trim(),
        reviewerName: reviewerName.trim(),
        eventTitle:  eventTitle?.trim() || null,
        isPublished: true,
      },
    });

    return NextResponse.json({ id: review.id });
  } catch {
    return NextResponse.json({ error: "Database unavailable. Please try again later." }, { status: 503 });
  }
}
