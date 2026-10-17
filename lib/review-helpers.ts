export type OrganiserRating = {
  average: number;
  count: number;
};

export type TopRatedEvent = {
  eventId: string | null;
  eventTitle: string;
  average: number;
  count: number;
};

/** Average overall rating rounded to 1 decimal. Returns null when empty. */
export function averageOverallRating(
  ratings: Array<{ overallRating: number } | number>
): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce<number>((acc, r) => {
    const n = typeof r === "number" ? r : r.overallRating;
    return acc + n;
  }, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function toOrganiserRating(
  average: number | null | undefined,
  count: number
): OrganiserRating | null {
  if (!count || average == null || !Number.isFinite(average)) return null;
  return { average: Math.round(average * 10) / 10, count };
}

/** Top events by average overall rating, then review count. Max `limit`. */
export function topRatedEventsFromReviews(
  reviews: Array<{
    eventId?: string | null;
    eventTitle?: string | null;
    overallRating: number;
  }>,
  limit = 3
): TopRatedEvent[] {
  const buckets = new Map<string, { eventId: string | null; eventTitle: string; sum: number; count: number }>();

  for (const r of reviews) {
    const title = r.eventTitle?.trim() || null;
    const id = r.eventId?.trim() || null;
    if (!id && !title) continue;
    const key = id ? `id:${id}` : `title:${title!.toLowerCase()}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.sum += r.overallRating;
      existing.count += 1;
    } else {
      buckets.set(key, {
        eventId: id,
        eventTitle: title ?? "Event",
        sum: r.overallRating,
        count: 1,
      });
    }
  }

  return [...buckets.values()]
    .map((b) => ({
      eventId: b.eventId,
      eventTitle: b.eventTitle,
      average: Math.round((b.sum / b.count) * 10) / 10,
      count: b.count,
    }))
    .sort((a, b) => b.average - a.average || b.count - a.count)
    .slice(0, limit);
}

export function displayNameFromUser(user: {
  name: string | null;
  username: string | null;
  email: string;
}): string {
  if (user.name?.trim()) return user.name.trim().slice(0, 80);
  if (user.username?.trim()) return user.username.trim().slice(0, 80);
  const local = user.email.split("@")[0]?.trim();
  return (local || "Startline user").slice(0, 80);
}

/** Reasons offered when reporting a review. The API accepts only these. */
export const REVIEW_REPORT_REASONS = [
  "Spam or advertising",
  "Offensive or abusive",
  "False or misleading",
  "Not about this organiser",
  "Other",
] as const;

export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number];

export const REVIEW_REPORT_DETAILS_MAX = 400;

/** "Reason" or "Reason: details", the shape stored in ReviewReport.reason. */
export function formatReviewReportReason(reason: ReviewReportReason, details?: string | null): string {
  const extra = details?.trim();
  return extra ? `${reason}: ${extra}` : reason;
}
