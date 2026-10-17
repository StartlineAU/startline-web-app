import prisma from "@/lib/prisma";
import { sendReviewReportedEmails } from "@/lib/email";
import { adminReviewRecipients } from "@/lib/notify-admins-event-submitted";

/**
 * Email every platform admin that a review was reported (#374). The report is
 * already stored, so a failed send only costs the alert: the review still sits
 * in the admin portal's Reported tab.
 */
export async function notifyAdminsReviewReported(
  reviewId: string,
  reason: string,
): Promise<{ emailed: number }> {
  const [review, admins] = await Promise.all([
    prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        title: true,
        body: true,
        reviewerName: true,
        eventTitle: true,
        organiser: { select: { orgName: true, email: true } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.admin.findMany({ select: { email: true } }),
  ]);
  if (!review) return { emailed: 0 };

  const recipients = adminReviewRecipients(admins.map((a) => a.email));
  if (recipients.length === 0) return { emailed: 0 };

  await sendReviewReportedEmails(recipients, {
    reviewTitle: review.title,
    reviewBody: review.body,
    reviewerName: review.reviewerName,
    organiserName: review.organiser.orgName || review.organiser.email,
    eventTitle: review.eventTitle,
    reason,
    reportCount: review._count.reports,
  });

  return { emailed: recipients.length };
}
