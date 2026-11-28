import type { OrganiserRole } from "@prisma/client";

export interface OrganiserNotificationSource {
  /** The login email of whoever created the organisation. */
  email: string;
  /** The contact address given during onboarding. Often a shared inbox. */
  contactEmail: string | null;
  notifyManagers: boolean;
  /** Set up by an admin and not claimed yet (lib/organiser-claim.ts). */
  pendingClaim: boolean;
  members: { role: OrganiserRole; user: { email: string } }[];
}

/** Prisma select for everything organiserNotificationRecipients reads. */
export const ORGANISER_RECIPIENTS_SELECT = {
  email: true,
  contactEmail: true,
  notifyManagers: true,
  pendingClaim: true,
  members: { select: { role: true, user: { select: { email: true } } } },
} as const;

/**
 * Who hears about an organisation's events being reviewed.
 *
 * The account email and every owner always do. The contact email does too: it
 * is the address the organiser said to reach them on, and nothing was ever sent
 * to it (issue #348). Managers are included only while the owner has the
 * setting on. One person can sit behind several of these, so the list is
 * deduplicated case-insensitively and nobody is sent the same email twice.
 *
 * An organisation an admin set up and nobody has claimed gets none: its
 * addresses were typed in by Startline, and nobody there has agreed to hear
 * from us. Admins are copied on what matters through their own recipients.
 */
export function organiserNotificationRecipients(organiser: OrganiserNotificationSource): string[] {
  if (organiser.pendingClaim) return [];

  const candidates = [
    organiser.email,
    organiser.contactEmail,
    ...organiser.members
      .filter((m) => m.role === "OWNER" || organiser.notifyManagers)
      .map((m) => m.user.email),
  ];

  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const candidate of candidates) {
    const email = candidate?.trim();
    if (!email || !email.includes("@")) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(email);
  }
  return recipients;
}
