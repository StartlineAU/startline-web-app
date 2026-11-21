/**
 * Which of an organiser's contact details athletes see, and what they are.
 *
 * The organisation sets a default for each detail (Settings → Organisation)
 * and each event may override it from the listing editor. A null override
 * follows the organisation. Hidden details are dropped here, on the server, so
 * they never reach the browser: the event page and the ticket only ever
 * receive the resolved `OrganiserContact`.
 */

export type ContactField = "name" | "email" | "phone";

export const CONTACT_FIELDS: { field: ContactField; label: string }[] = [
  { field: "name", label: "Contact name" },
  { field: "email", label: "Email" },
  { field: "phone", label: "Phone" },
];

export type ContactVisibility = Record<ContactField, boolean>;
export type ContactOverride = Record<ContactField, boolean | null>;

/** New organisations: name and email on, phone off, since it is often a personal mobile. */
export const DEFAULT_CONTACT_VISIBILITY: ContactVisibility = { name: true, email: true, phone: false };

export const NO_CONTACT_OVERRIDE: ContactOverride = { name: null, email: null, phone: null };

export type OrganiserContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

/** The Prisma columns, under the names the schema gives them. */
export type ContactDisplayColumns = {
  showContactName: boolean | null;
  showContactEmail: boolean | null;
  showContactPhone: boolean | null;
};

export type OrganiserContactSource = ContactDisplayColumns & {
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
};

/** Selects every column `resolveOrganiserContact` reads, for a Prisma `select`. */
export const organiserContactSelect = {
  contactName: true,
  contactEmail: true,
  phone: true,
  showContactName: true,
  showContactEmail: true,
  showContactPhone: true,
} as const;

export const eventContactSelect = {
  showContactName: true,
  showContactEmail: true,
  showContactPhone: true,
} as const;

export function visibilityFromColumns(columns: Partial<ContactDisplayColumns>): ContactVisibility {
  return {
    name: columns.showContactName ?? DEFAULT_CONTACT_VISIBILITY.name,
    email: columns.showContactEmail ?? DEFAULT_CONTACT_VISIBILITY.email,
    phone: columns.showContactPhone ?? DEFAULT_CONTACT_VISIBILITY.phone,
  };
}

export function overrideFromColumns(columns: Partial<ContactDisplayColumns>): ContactOverride {
  return {
    name: columns.showContactName ?? null,
    email: columns.showContactEmail ?? null,
    phone: columns.showContactPhone ?? null,
  };
}

/** The event's choice where it made one, the organisation's otherwise. */
export function effectiveVisibility(organisation: ContactVisibility, event: ContactOverride): ContactVisibility {
  return {
    name: event.name ?? organisation.name,
    email: event.email ?? organisation.email,
    phone: event.phone ?? organisation.phone,
  };
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * What athletes may see. Null when nothing is shown, so callers can leave the
 * whole section out rather than render an empty heading.
 */
export function resolveOrganiserContact(
  organiser: OrganiserContactSource,
  event: Partial<ContactDisplayColumns> = {},
): OrganiserContact | null {
  const show = effectiveVisibility(visibilityFromColumns(organiser), overrideFromColumns(event));
  const contact: OrganiserContact = {
    name: show.name ? present(organiser.contactName) : null,
    email: show.email ? present(organiser.contactEmail) : null,
    phone: show.phone ? present(organiser.phone) : null,
  };
  return contact.name || contact.email || contact.phone ? contact : null;
}

/** `tel:` wants digits and a leading +, not the spaces people type. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
