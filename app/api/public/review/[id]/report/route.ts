import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { recordSecurityEvent } from "@/lib/security-event";
import { rateLimit } from "@/lib/rate-limit";
import {
  REVIEW_REPORT_DETAILS_MAX,
  REVIEW_REPORT_REASONS,
  formatReviewReportReason,
} from "@/lib/review-helpers";
import { notifyAdminsReviewReported } from "@/lib/notify-admins-review-reported";
import { z } from "zod";

const reportSchema = z
  .object({
    reason: z.enum(REVIEW_REPORT_REASONS, { message: "Choose a reason for the report." }),
    details: z.string().trim().max(REVIEW_REPORT_DETAILS_MAX).optional(),
  })
  .refine((d) => d.reason !== "Other" || !!d.details, {
    message: "Tell us what is wrong with this review.",
  });

// POST /api/public/review/[id]/report — flag a review for moderation. Reported
// reviews are not auto-hidden; they surface in the admin Reported tab and every
// admin is emailed.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to report a review." }, { status: 401 });
  }

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  const { id } = parsedParams.data;

  const blocked = await rateLimit(req, {
    prefix: "review-report",
    limit: 10,
    windowSeconds: 3600,
    identifier: session.sub,
  });
  if (blocked) return blocked;

  const parsed = reportSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid report." },
      { status: 400 },
    );
  }
  const reason = formatReviewReportReason(parsed.data.reason, parsed.data.details);

  const review = await prisma.review.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (review.userId === session.sub) {
    return NextResponse.json({ error: "You can't report your own review." }, { status: 400 });
  }

  try {
    await prisma.reviewReport.create({
      data: {
        reviewId: id,
        userId: session.sub,
        reason,
      },
    });
  } catch (err) {
    if ((err as Record<string, unknown>).code === "P2002") {
      return NextResponse.json({ error: "You've already reported this review." }, { status: 409 });
    }
    console.error("Review report error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  await recordSecurityEvent({
    type: "review_reported",
    action: "review_report",
    userId: session.sub,
    meta: { reviewId: id, reason },
  });

  await notifyAdminsReviewReported(id, reason)
    .catch((err) => console.error("Review report notify failed:", err));

  return NextResponse.json({ ok: true }, { status: 201 });
}
