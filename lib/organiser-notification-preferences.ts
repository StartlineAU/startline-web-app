import type { NotificationType } from "@prisma/client";

/** The organisation's own switches, one per kind of notification. */
export interface OrganiserNotificationPreferences {
  notifyEventApproved: boolean;
  notifyEventRejected: boolean;
  notifyNewRegistration: boolean;
  notifyEventFinished: boolean;
}

export const NOTIFICATION_PREFERENCE_FIELD = {
  EVENT_APPROVED:   "notifyEventApproved",
  EVENT_REJECTED:   "notifyEventRejected",
  NEW_REGISTRATION: "notifyNewRegistration",
  EVENT_FINISHED:   "notifyEventFinished",
} as const satisfies Partial<Record<NotificationType, keyof OrganiserNotificationPreferences>>;

/**
 * Whether an organisation has asked to hear about this kind of event. Off means
 * off everywhere: no entry in the in-app feed and no email. Callers skip both.
 */
export function wantsNotification(
  organiser: OrganiserNotificationPreferences,
  type: NotificationType,
): boolean {
  // Kinds with no switch (a refund override, a cancelled event) always go out:
  // they are about money the organisation is answerable for.
  const field = (NOTIFICATION_PREFERENCE_FIELD as Partial<Record<NotificationType, keyof OrganiserNotificationPreferences>>)[type];
  if (!field) return true;
  return organiser[field] !== false;
}
