import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { z } from "zod";

const reviewsQuery = z.object({
  filter: z.enum(["all", "reported", "published", "hidden"]).catch("all"),
});

// Reasons shown per review in the Reported queue. Dismiss clears every report,
// so the queue only has to be deep enough to judge the review.
const REPORT_PREVIEW_LIMIT = 20;

export const dynamic = "force-dynamic";

// GET /api/admin/reviews?filter=all|reported|published|hidden
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { filter } = reviewsQuery.parse(Object.fromEntries(searchParams));
  const where =
    filter === "reported"  ? { reports: { some: {} } }
    : filter === "published" ? { isPublished: true }
    : filter === "hidden"  ? { isPublished: false }
    : {};

  try {
    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        overallRating:       true,
        atmosphereRating: true,
        organisationRating:  true,
        experienceRating:    true,
        title:        true,
        body:         true,
        reviewerName: true,
        eventTitle:   true,
        isVerified:   true,
        isPublished:  true,
        createdAt:    true,
        organiser: { select: { id: true, orgName: true, email: true } },
        // Every tab shows the count; only the Reported queue reads the reasons,
        // and only the newest few, so a heavily reported review cannot blow up
        // the response.
        _count: { select: { reports: true } },
        reports: {
          orderBy: { createdAt: "desc" },
          take: filter === "reported" ? REPORT_PREVIEW_LIMIT : 0,
          select: { id: true, reason: true, createdAt: true },
        },
      },
    });
    const rows = reviews.map(({ _count, ...review }) => ({ ...review, reportCount: _count.reports }));
    // The Reported tab leads with the most recently reported review.
    if (filter === "reported") {
      const latest = (r: (typeof rows)[number]) => r.reports[0]?.createdAt.getTime() ?? 0;
      rows.sort((a, b) => latest(b) - latest(a));
    }
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Admin reviews fetch error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
