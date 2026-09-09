import { getPublicEventById } from "@/lib/events";
import { parsePrizePool, type PrizePool } from "@/lib/prize-pool";
import { averageOverallRating, getPublishedOrganiserReviews, type OrganiserRating, type PublicReview } from "@/lib/reviews";
import { toUserEvent } from "@/lib/user-events";
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
};

export async function getEventDetail(id: string): Promise<EventDetailData | null> {
  const found = await getPublicEventById(id);
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
    prizePool: parsePrizePool(found.extras),
    organiserName: event.organizer ?? event.organiser?.orgName ?? "Organiser",
    organiserRating,
    organiserReviews,
  };
}
