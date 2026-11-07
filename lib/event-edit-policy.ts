/**
 * Which events an organiser may edit directly.
 *
 * Published events are editable again (part of #490), but not silently: every
 * edit after an event first leaves DRAFT is written to the event change log,
 * and changing the date, time, location or event type of an event with paid
 * entries gives those athletes a full refund entitlement, which the organiser
 * must confirm before the change saves. See `lib/event-change-log.ts`.
 *
 * Events that are underway or finished stay locked: race day is not the time
 * to move the start line.
 */
export const ORGANISER_EDITABLE_EVENT_STATUSES = ["DRAFT", "PENDING", "REJECTED", "APPROVED"] as const;

export type OrganiserEditableEventStatus = (typeof ORGANISER_EDITABLE_EVENT_STATUSES)[number];

export function organiserCanEditEvent(status: string | null | undefined): boolean {
  return ORGANISER_EDITABLE_EVENT_STATUSES.includes(status as OrganiserEditableEventStatus);
}

/** Live events: an edit keeps them live and never sends them back to review. */
export function isLiveEventStatus(status: string | null | undefined): boolean {
  return status === "APPROVED" || status === "IN_PROGRESS";
}

export function organiserEditBlockedMessage(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "Events that are underway can't be edited. Post an announcement for updates, or contact Startline if something must change.";
    case "ARCHIVED":
      return "Archived events can't be edited.";
    default:
      return "This event can't be edited here.";
  }
}
