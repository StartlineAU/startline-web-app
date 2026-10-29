import prisma from "@/lib/prisma";
import { sendReviewReportedEmails } from "@/lib/email";
import { listAdminReviewRecipients } from "@/lib/admin-notification-recipients";

/**
 * Email every platform admin that a review was reported (#374). The report is
 * already stored, so a failed send only costs the alert: the review still sits
 * in the admin portal's Reported tab.
 *
 * Recipients come from the Cognito `admins` group at send time (issue #337),
 * so an admin who has never signed in to the admin portal is still reached.
 */
export async function notifyAdminsReviewReported(
  reviewId: string,
  reason: string,
): Promise<{ emailed: number }> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      title: true,
      body: true,
      reviewerName: true,
      eventTitle: true,
      organiser: { select: { orgName: true, email: true } },
      _count: { select: { reports: true } },
    },
  });
  if (!review) return { emailed: 0 };

  const recipients = await listAdminReviewRecipients();
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
