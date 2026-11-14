import prisma from "@/lib/prisma";
import { sendFollowedOrganiserEventEmails } from "@/lib/email";

export type NotifyOrganiserFollowersInput = {
  organiserId: string;
  eventId: string;
  eventTitle: string;
  organiserName?: string | null;
  eventDate?: string | null;
  city?: string | null;
};

/**
 * Notify every follower of an organiser that a new event is live.
 * Call only on transitions into APPROVED (not on every edit).
 * Returns counts. Emails go out in Resend batches; a failed batch is logged
 * and does not stop the rest.
 */
export async function notifyOrganiserFollowers(
  input: NotifyOrganiserFollowersInput,
): Promise<{ notified: number; emailed: number }> {
  // Followers who turned these off get neither the feed entry nor the email.
  const follows = await prisma.organiserFollow.findMany({
    where: { organiserId: input.organiserId, user: { notifyFollowedOrganiserEvents: true } },
    select: {
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (follows.length === 0) return { notified: 0, emailed: 0 };

  const organiserLabel = input.organiserName?.trim() || "An organiser you follow";
  const title = `${organiserLabel} posted a new event`;
  const body = input.eventTitle;

  await prisma.userNotification.createMany({
    data: follows.map((f) => ({
      userId: f.userId,
      type: "ORGANISER_EVENT_LIVE" as const,
      title,
      body,
      eventId: input.eventId,
    })),
  });

  let emailed = 0;
  try {
    emailed = await sendFollowedOrganiserEventEmails(
      follows
        .filter((f) => f.user.email)
        .map((f) => ({
          to: f.user.email!,
          data: {
            followerName: f.user.name,
            organiserName: organiserLabel,
            eventTitle: input.eventTitle,
            eventId: input.eventId,
            eventDate: input.eventDate,
            city: input.city,
          },
        })),
    );
  } catch (err) {
    console.error("Failed to send follower event emails:", err);
  }

  return { notified: follows.length, emailed };
}

/** Pure helpers for unit tests — build in-app notification rows for followers. */
export function buildOrganiserEventLiveNotifications(
  followerUserIds: string[],
  input: Pick<NotifyOrganiserFollowersInput, "eventId" | "eventTitle" | "organiserName">,
) {
  const organiserLabel = input.organiserName?.trim() || "An organiser you follow";
  return followerUserIds.map((userId) => ({
    userId,
    type: "ORGANISER_EVENT_LIVE" as const,
    title: `${organiserLabel} posted a new event`,
    body: input.eventTitle,
    eventId: input.eventId,
  }));
}
