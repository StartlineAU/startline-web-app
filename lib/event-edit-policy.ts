/**
 * Which events an organiser may edit directly.
 *
 * Published events are changed by Startline staff on request, not by the
 * organiser, so the public offer cannot silently change after athletes have
 * entered. Pre-publication events keep their edit/resubmit path.
 */
export const ORGANISER_EDITABLE_EVENT_STATUSES = ["DRAFT", "PENDING", "REJECTED"] as const;

export type OrganiserEditableEventStatus = (typeof ORGANISER_EDITABLE_EVENT_STATUSES)[number];

export function organiserCanEditEvent(status: string | null | undefined): boolean {
  return ORGANISER_EDITABLE_EVENT_STATUSES.includes(status as OrganiserEditableEventStatus);
}

export function organiserEditBlockedMessage(status: string): string {
  switch (status) {
    case "APPROVED":
      return "Published event details can't be edited directly. Post an announcement for updates, or contact Startline to change the listing.";
    case "IN_PROGRESS":
      return "Events that are underway can't be edited. Post an announcement for updates, or contact Startline if something must change.";
    case "ARCHIVED":
      return "Archived events can't be edited.";
    default:
      return "This event can't be edited here.";
  }
}
