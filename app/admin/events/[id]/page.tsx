import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import AdminEventReviewBar from "@/components/admin/AdminEventReviewBar";
import EventDetailView from "@/components/event/EventDetailView";
import { getAdminSession } from "@/lib/amplify-server";
import { approvalBlocker } from "@/lib/event-approval";
import { getEventDetail } from "@/lib/event-detail";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event preview",
  robots: { index: false, follow: false },
};

function formatSubmitted(date: Date) {
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * An event exactly as athletes will see it, at any status (issue #321). The
 * review queue only shows a title and a thumbnail, which is not enough to judge
 * a listing, and the public page 404s until the event is approved.
 */
export default async function AdminEventPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { id } = await params;

  const [detail, review] = await Promise.all([
    getEventDetail(id, { anyStatus: true }),
    prisma.event.findFirst({
      where:  { OR: [{ id }, { slug: id }] },
      select: {
        id: true,
        status: true,
        createdAt: true,
        rejectionReason: true,
        registrationType: true,
        organiser: {
          select: { orgName: true, contactName: true, email: true, abn: true, stripeOnboardingComplete: true },
        },
      },
    }).catch(() => null),
  ]);

  if (!detail || !review) notFound();

  const { organiser } = review;

  return (
    <main className="min-h-screen bg-dark-darker pt-14">
      <AdminEventReviewBar
        eventId={review.id}
        status={review.status}
        organiserName={organiser.orgName || organiser.contactName || organiser.email}
        submittedAt={formatSubmitted(review.createdAt)}
        blocker={approvalBlocker(review)}
        rejectionReason={review.rejectionReason}
      />
      <EventDetailView data={detail} hideBackLink />
    </main>
  );
}
