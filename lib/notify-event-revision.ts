import prisma from "@/lib/prisma";
import { listAdminReviewRecipients } from "@/lib/admin-notification-recipients";
import { changeLines } from "@/lib/notify-event-change";
import type { EventFieldChange } from "@/lib/event-change-log";
import {
  sendEventEditDecisionEmail,
  sendEventEditPendingReviewEmails,
} from "@/lib/email";
import { organiserNotificationRecipients } from "@/lib/organiser-notification-recipients";
import { organiserUrl } from "@/lib/portal-domains";
import { wantsNotification } from "@/lib/organiser-notification-preferences";

/** Tell admins an unverified organiser's edit is waiting. The listing is unchanged. */
export async function notifyAdminsEventEditPending(input: {
  eventId: string;
  changes: EventFieldChange[];
}): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      title: true,
      organiser: { select: { orgName: true, contactName: true, email: true } },
    },
  });
  if (!event) return;
  const recipients = await listAdminReviewRecipients();
  await sendEventEditPendingReviewEmails(recipients, {
    eventId: event.id,
    eventTitle: event.title,
    organiserName: event.organiser.orgName || event.organiser.contactName || event.organiser.email,
    changes: changeLines(input.changes),
  });
}

async function organiserRecipients(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      organiser: {
        select: {
          email: true,
          contactEmail: true,
          notifyManagers: true,
          notifyEventApproved: true,
          notifyEventRejected: true,
          notifyNewRegistration: true,
          members: { select: { role: true, user: { select: { email: true } } } },
        },
      },
    },
  });
}

/** Tell the organisation the queued edit was approved or rejected. The listing never left sale. */
export async function notifyOrganiserRevisionDecision(input: {
  eventId: string;
  approved: boolean;
  reason?: string;
}): Promise<void> {
  const event = await organiserRecipients(input.eventId);
  if (!event) return;
  const preference = input.approved ? "EVENT_APPROVED" : "EVENT_REJECTED";
  if (!wantsNotification(event.organiser, preference)) return;
  const recipients = organiserNotificationRecipients(event.organiser);
  const eventUrl = organiserUrl(
    `/organiser/events/${event.id}/dashboard`,
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  await Promise.all(recipients.map((to) =>
    sendEventEditDecisionEmail(to, {
      eventTitle: event.title,
      approved: input.approved,
      reason: input.reason,
      eventUrl,
    }).catch((err) => console.error("Event edit decision email failed:", err)),
  ));
}

export async function notifyOrganiserRevisionSuperseded(eventId: string): Promise<void> {
  const event = await organiserRecipients(eventId);
  if (!event) return;
  const recipients = organiserNotificationRecipients(event.organiser);
  const eventUrl = organiserUrl(
    `/organiser/events/${event.id}/dashboard`,
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  await Promise.all(recipients.map((to) =>
    sendEventEditDecisionEmail(to, {
      eventTitle: event.title,
      approved: false,
      reason: "Startline edited the live listing, so the changes you had waiting were set aside.",
      eventUrl,
    }).catch((err) => console.error("Event edit superseded email failed:", err)),
  ));
}
