import { getEventByIdForAdmin, getPublicEventById } from "@/lib/events";
import { parsePrizePool, type PrizePool } from "@/lib/prize-pool";
import { averageOverallRating, getPublishedOrganiserReviews, type OrganiserRating, type PublicReview } from "@/lib/reviews";
import { toUserEvent } from "@/lib/user-events";
import prisma from "@/lib/prisma";
import {
  eventContactSelect, organiserContactSelect, resolveOrganiserContact, type OrganiserContact,
} from "@/lib/organiser-contact";
import type { UserEvent } from "@/types";

/**
 * Everything the event information screen renders, resolved. The event page
 * builds this on the server; the events listing fetches the same shape from
 * `/api/events/[id]/detail` for the panel beside its results, so both show the
 * identical page rather than two drifting versions of it.
 */
export type EventDetailData = {
  event: UserEvent;
  prizePool: PrizePool | null;
  organiserName: string;
  organiserRating: OrganiserRating | null;
  organiserReviews: PublicReview[];
  /** Only the details the organiser chose to show; null when they show none. */
  organiserContact: OrganiserContact | null;
};

export async function getEventDetail(
  id: string,
  // Admin preview only (issue #321): resolves the event whatever its status,
  // so a listing can be seen as athletes will see it before it is approved.
  { anyStatus = false }: { anyStatus?: boolean } = {},
): Promise<EventDetailData | null> {
  const found = anyStatus ? await getEventByIdForAdmin(id) : await getPublicEventById(id);
  if (!found) return null;

  const event = toUserEvent(found);
  const organiserReviews = await getPublishedOrganiserReviews(event.organiserId);
  const organiserRating =
    event.organiser?.rating ??
    (() => {
      const avg = averageOverallRating(organiserReviews);
      return avg != null ? { average: avg, count: organiserReviews.length } : null;
    })();

  return {
    event,
    organiserContact: await loadOrganiserContact(event.id),
    prizePool: parsePrizePool(found.extras),
    organiserName: event.organizer ?? event.organiser?.orgName ?? "Organiser",
    organiserRating,
    organiserReviews,
  };
}

/**
 * Read apart from the public event select on purpose: that shape is what the
 * listing APIs send to the browser, and the raw contact columns, hidden ones
 * included, must never travel with it.
 */
async function loadOrganiserContact(eventId: string): Promise<OrganiserContact | null> {
  try {
    const row = await prisma.event.findUnique({
      where: { id: eventId },
      select: { ...eventContactSelect, organiser: { select: organiserContactSelect } },
    });
    return row ? resolveOrganiserContact(row.organiser, row) : null;
  } catch {
    return null;
  }
}
