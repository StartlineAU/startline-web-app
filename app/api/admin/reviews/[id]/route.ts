import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { z } from "zod";

const reviewModerationSchema = z.object({
  isPublished: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  /** Clear every report: the review was checked and is fine to stay up. */
  dismissReports: z.literal(true).optional(),
});

// PATCH /api/admin/reviews/[id]  — moderate a review (publish / verify toggles,
// dismiss reports)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const parsedBody = reviewModerationSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const data: { isPublished?: boolean; isVerified?: boolean } = {};
  if (parsedBody.data.isPublished !== undefined) data.isPublished = parsedBody.data.isPublished;
  if (parsedBody.data.isVerified !== undefined)  data.isVerified  = parsedBody.data.isVerified;

  const dismissReports = parsedBody.data.dismissReports === true;

  if (Object.keys(data).length === 0 && !dismissReports) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const review = await prisma.review.update({
      where: { id },
      data: dismissReports ? { ...data, reports: { deleteMany: {} } } : data,
      select: { id: true, isPublished: true, isVerified: true, _count: { select: { reports: true } } },
    });
    const { _count, ...rest } = review;
    return NextResponse.json({ ...rest, reportCount: _count.reports });
  } catch (err) {
    console.error("Admin review update error:", err);
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
}

// DELETE /api/admin/reviews/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  try {
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin review delete error:", err);
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
}
