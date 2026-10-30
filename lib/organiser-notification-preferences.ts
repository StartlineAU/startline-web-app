import type { NotificationType } from "@prisma/client";

/** The organisation's own switches, one per kind of notification. */
export interface OrganiserNotificationPreferences {
  notifyEventApproved: boolean;
  notifyEventRejected: boolean;
  notifyNewRegistration: boolean;
}

export const NOTIFICATION_PREFERENCE_FIELD = {
  EVENT_APPROVED:   "notifyEventApproved",
  EVENT_REJECTED:   "notifyEventRejected",
  NEW_REGISTRATION: "notifyNewRegistration",
} as const satisfies Record<NotificationType, keyof OrganiserNotificationPreferences>;

/**
 * Whether an organisation has asked to hear about this kind of event. Off means
 * off everywhere: no entry in the in-app feed and no email. Callers skip both.
 */
export function wantsNotification(
  organiser: OrganiserNotificationPreferences,
  type: NotificationType,
): boolean {
  return organiser[NOTIFICATION_PREFERENCE_FIELD[type]] !== false;
}
