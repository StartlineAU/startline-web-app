import prisma from "@/lib/prisma";
import { sendEventSubmittedForReviewEmails } from "@/lib/email";
import { approvalBlocker } from "@/lib/event-approval";

// RFC 2606 / 6761 names that can never receive mail. The seed creates its
// admins on @startline.test, and staging's database holds them, so sending to
// every admin row there would bounce and hurt the sender's reputation.
const UNDELIVERABLE_TLDS = [".test", ".example", ".invalid", ".localhost"];

/** Deliverable, de-duplicated admin addresses. */
export function adminReviewRecipients(emails: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const raw of emails) {
    const email = raw?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (UNDELIVERABLE_TLDS.some((tld) => email.endsWith(tld))) continue;
    seen.add(email);
  }
  return [...seen];
}

/**
 * Email every platform admin that an organiser's event is waiting for review
 * (issue #321). Call only on a transition into PENDING from the organiser side.
 *
 * Recipients are the Admin rows, which exist for everyone in the Cognito
 * `admins` group who has signed in to the admin portal, so a new team member
 * starts receiving these once they have logged in once.
 */
export async function notifyAdminsEventSubmitted(eventId: string): Promise<{ emailed: number }> {
  const [event, admins] = await Promise.all([
    prisma.event.findUnique({
      where:  { id: eventId },
      select: {
        id: true, title: true, status: true, eventDate: true, city: true, state: true,
        discipline: true, registrationType: true,
        organiser: {
          select: { orgName: true, contactName: true, email: true, abn: true, stripeOnboardingComplete: true },
        },
      },
    }),
    prisma.admin.findMany({ select: { email: true } }),
  ]);

  if (!event || event.status !== "PENDING") return { emailed: 0 };

  const recipients = adminReviewRecipients(admins.map((a) => a.email));
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
