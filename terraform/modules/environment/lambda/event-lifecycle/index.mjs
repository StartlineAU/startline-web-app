/**
 * Wake the app's lifecycle route. The Lambda deliberately has no database
 * credentials: the route owns the transition rules, and every invocation is
 * idempotent and safe to retry.
 */
export const handler = async (event = {}) => {
  const base = process.env.APP_URL;
  const secret = process.env.EVENT_LIFECYCLE_SECRET;
  if (!base || !secret) throw new Error("Lifecycle target is not configured");

  const query = event.eventId
    ? `eventId=${encodeURIComponent(event.eventId)}`
    : "sweep=1";

  const response = await fetch(`${base.replace(/\/$/, "")}/api/internal/events/lifecycle?${query}`, {
    method: "POST",
    headers: { "x-event-lifecycle-secret": secret },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Lifecycle route returned ${response.status}: ${body.slice(0, 500)}`);
  }

  return { statusCode: response.status, body };
};
