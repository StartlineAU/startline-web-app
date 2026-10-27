import prisma from "@/lib/prisma";
import { sendEventSubmittedForReviewEmails } from "@/lib/email";
import { approvalBlocker } from "@/lib/event-approval";
import { listAdminReviewRecipients } from "@/lib/admin-notification-recipients";

/**
 * Email every platform admin that an organiser's event is waiting for review
 * (issue #321). Call only on a transition into PENDING from the organiser side.
 *
 * Recipients come from the Cognito `admins` group at send time (issue #337),
 * not the Admin table, which only has rows for admins who have signed in to
 * the admin portal at least once.
 */
export async function notifyAdminsEventSubmitted(eventId: string): Promise<{ emailed: number }> {
  const event = await prisma.event.findUnique({
    where:  { id: eventId },
    select: {
      id: true, title: true, status: true, eventDate: true, city: true, state: true,
      discipline: true, registrationType: true, waves: true,
      organiser: {
        select: { orgName: true, contactName: true, email: true, abn: true, stripeOnboardingComplete: true },
      },
    },
  });

  // Don't pay for a Cognito call when there is nothing to announce.
  if (!event || event.status !== "PENDING") return { emailed: 0 };

  const recipients = await listAdminReviewRecipients();
  if (recipients.length === 0) return { emailed: 0 };

  await sendEventSubmittedForReviewEmails(recipients, {
    eventId:       event.id,
    eventTitle:    event.title,
    organiserName: event.organiser.orgName || event.organiser.contactName || event.organiser.email,
    eventDate:     event.eventDate || null,
    city:          event.city || null,
    state:         event.state || null,
    discipline:    event.discipline || null,
    blocker:       approvalBlocker(event),
  });

  return { emailed: recipients.length };
}
