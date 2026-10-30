import type { OrganiserRole } from "@prisma/client";

export interface OrganiserNotificationSource {
  /** The login email of whoever created the organisation. */
  email: string;
  /** The contact address given during onboarding. Often a shared inbox. */
  contactEmail: string | null;
  notifyManagers: boolean;
  members: { role: OrganiserRole; user: { email: string } }[];
}

/**
 * Who hears about an organisation's events being reviewed.
 *
 * The account email and every owner always do. The contact email does too: it
 * is the address the organiser said to reach them on, and nothing was ever sent
 * to it (issue #348). Managers are included only while the owner has the
 * setting on. One person can sit behind several of these, so the list is
 * deduplicated case-insensitively and nobody is sent the same email twice.
 */
export function organiserNotificationRecipients(organiser: OrganiserNotificationSource): string[] {
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
