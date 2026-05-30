import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";

// PATCH /api/admin/reviews/[id]  — moderate a review (publish / verify toggles)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    isPublished?: boolean;
    isVerified?: boolean;
  };

  const data: { isPublished?: boolean; isVerified?: boolean } = {};
  if (typeof body.isPublished === "boolean") data.isPublished = body.isPublished;
  if (typeof body.isVerified === "boolean")  data.isVerified  = body.isVerified;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const review = await prisma.review.update({
      where: { id },
      data,
      select: { id: true, isPublished: true, isVerified: true },
    });
    return NextResponse.json(review);
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

  const { id } = await params;
  try {
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin review delete error:", err);
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
}
