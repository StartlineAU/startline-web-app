import type { EventChangeKind, EventChangeSource, EventStatus, Prisma } from "@prisma/client";

/**
 * The event change log (see `EventChange` in the schema) and the rules for
 * which edits are "material".
 *
 * A material change is one an athlete reasonably entered on the strength of:
 * when the event is, where it is, and what kind of event it is. Changing any
 * of those after athletes have paid entitles each of them to a full refund,
 * platform fee included (issue #490). Everything else (description, images,
 * pricing for future entries) is logged but carries no entitlement.
 */

export interface EventFieldChange {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
  material: boolean;
}

/** Fields an organiser or admin edits, in the order the history lists them. */
export const LOGGED_EVENT_FIELDS = [
  "title", "discipline", "format", "level", "categories", "cap", "minAge",
  "eventDate", "endDate", "startTime", "endTime",
  "venue", "address", "city", "state", "latitude", "longitude",
  "waves", "refundTiers", "refundPolicy", "registrationType", "feeStructure", "registrationUrl",
  "description", "inclusions", "extras", "activations", "accessibilityInfo",
  "coverImageUrl", "informationPdfs", "photos",
] as const;

export type LoggedEventField = (typeof LOGGED_EVENT_FIELDS)[number];

export const MATERIAL_FIELD_GROUPS = {
  "date and time": ["eventDate", "endDate", "startTime", "endTime"],
  location: ["venue", "address", "city", "state"],
  "event type": ["discipline", "format"],
} as const satisfies Record<string, readonly LoggedEventField[]>;

const MATERIAL_FIELDS = new Set<string>(Object.values(MATERIAL_FIELD_GROUPS).flat());

export function isMaterialField(field: string): boolean {
  return MATERIAL_FIELDS.has(field);
}

export const EVENT_FIELD_LABELS: Record<LoggedEventField, string> = {
  title: "Title",
  discipline: "Discipline",
  format: "Format",
  level: "Intensity level",
  categories: "Divisions",
  cap: "Participant cap",
  minAge: "Minimum age",
  eventDate: "Start date",
  endDate: "End date",
  startTime: "Start time",
  endTime: "Cut-off time",
  venue: "Venue",
  address: "Address",
  city: "City",
  state: "State",
  latitude: "Map latitude",
  longitude: "Map longitude",
  waves: "Ticket categories",
  refundTiers: "Refund rules",
  refundPolicy: "Refund notes",
  registrationType: "Registration platform",
  feeStructure: "Booking fee paid by",
  registrationUrl: "External registration link",
  description: "Description",
  inclusions: "Inclusions",
  extras: "Prize money",
  activations: "Activations",
  accessibilityInfo: "Accessibility",
  coverImageUrl: "Cover image",
  informationPdfs: "Information PDFs",
  photos: "Gallery photos",
};

/** How long after a material change an existing entrant can claim a full refund. */
export const FULL_REFUND_WINDOW_DAYS = 14;

/**
 * The moment a full-refund entitlement from a change made at `changedAt`
 * expires: 14 days later, or when the (changed) event starts if that is sooner.
 * Once the race is run the spot has been used.
 */
export function fullRefundDeadline(changedAt: Date, startsAtUtc: Date | null | undefined): Date {
  const windowEnd = new Date(changedAt.getTime() + FULL_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (!startsAtUtc || startsAtUtc.getTime() > windowEnd.getTime()) return windowEnd;
  return startsAtUtc;
}

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Stable JSON: object keys sorted, so key order never reads as a change. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * The comparison key for one field's value. Blank values (null, "", []) are
 * all the same thing to an athlete. Material text is compared ignoring case
 * and spacing, so tidying "albert  park" into "Albert Park" never costs an
 * organiser a round of full refunds.
 */
function comparable(field: string, value: unknown): string {
  if (isBlank(value)) return "∅";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return isMaterialField(field) ? trimmed.replace(/\s+/g, " ").toLowerCase() : trimmed;
  }
  return stableStringify(value);
}

function stored(value: unknown): unknown {
  if (isBlank(value)) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Field-level differences between the stored event and the values an edit is
 * about to write. A field the edit leaves `undefined` is not being written and
 * is never a change, which is what makes this safe on a partial PATCH.
 */
export function diffEventFields(
  before: Record<string, unknown>,
  next: Record<string, unknown>,
): EventFieldChange[] {
  const changes: EventFieldChange[] = [];
  for (const field of LOGGED_EVENT_FIELDS) {
    if (!(field in next) || next[field] === undefined) continue;
    if (comparable(field, before[field]) === comparable(field, next[field])) continue;
    changes.push({
      field,
      label: EVENT_FIELD_LABELS[field],
      from: stored(before[field]),
      to: stored(next[field]),
      material: isMaterialField(field),
    });
  }
  return changes;
}

/** Every populated field, as the "original information" row for an event. */
export function baselineChanges(event: Record<string, unknown>): EventFieldChange[] {
  const changes: EventFieldChange[] = [];
  for (const field of LOGGED_EVENT_FIELDS) {
    if (isBlank(event[field])) continue;
    changes.push({
      field,
      label: EVENT_FIELD_LABELS[field],
      from: null,
      to: stored(event[field]),
      material: isMaterialField(field),
    });
  }
  return changes;
}

export function materialChanges(changes: EventFieldChange[]): EventFieldChange[] {
  return changes.filter((c) => c.material);
}

/** The groups a set of changes touches, e.g. ["date and time", "location"]. */
export function materialGroupsChanged(changes: EventFieldChange[]): string[] {
  const fields = new Set(changes.filter((c) => c.material).map((c) => c.field));
  return Object.entries(MATERIAL_FIELD_GROUPS)
    .filter(([, group]) => group.some((f) => fields.has(f)))
    .map(([name]) => name);
}

/**
 * Entries that gain a full-refund entitlement when the event changes: paid and
 * still confirmed. A free entry has nothing to refund, and an entry already on
 * its way out (refund requested, refunded, cancelled) is not "registered".
 */
export function entitledRegistrationsWhere(eventId: string): Prisma.RegistrationWhereInput {
  return { eventId, status: "CONFIRMED", amountCents: { gt: 0 } };
}

export interface RecordEventChangeInput {
  /** Preassigned so registrations can point at the row before it is written. */
  id?: string;
  eventId: string;
  eventTitle: string;
  source: EventChangeSource;
  kind: EventChangeKind;
  changedById?: string | null;
  changedByEmail?: string | null;
  organiserVerified: boolean;
  statusAtChange: EventStatus;
  changes: EventFieldChange[];
  affectedCount?: number;
  fullRefundUntil?: Date | null;
}

/**
 * Append one row to the change log. Takes the transaction client so the row
 * commits or rolls back with the edit it describes: an edit can never land
 * without its record, and a failed edit leaves no phantom record behind.
 */
export async function recordEventChange(
  tx: Prisma.TransactionClient,
  input: RecordEventChangeInput,
) {
  return tx.eventChange.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      eventId: input.eventId,
      eventTitle: input.eventTitle,
      source: input.source,
      kind: input.kind,
      changedById: input.changedById ?? null,
      changedByEmail: input.changedByEmail ?? null,
      organiserVerified: input.organiserVerified,
      statusAtChange: input.statusAtChange,
      changes: input.changes as unknown as Prisma.InputJsonValue,
      material: input.changes.some((c) => c.material),
      affectedCount: input.affectedCount ?? 0,
      fullRefundUntil: input.fullRefundUntil ?? null,
    },
    select: { id: true },
  });
}

/** Human-readable value for the history and for emails. */
export function describeChangeValue(field: string, value: unknown): string {
  if (isBlank(value)) return "(none)";
  if (field === "waves" && Array.isArray(value)) {
    return value
      .map((w) => {
        const tier = w as { label?: string; price?: string | number };
        const price = tier.price === undefined || tier.price === "" ? "" : ` $${tier.price}`;
        return `${tier.label || "Ticket"}${price}`;
      })
      .join(", ");
  }
  if (field === "refundTiers" && Array.isArray(value)) {
    return value
      .map((t) => {
        const tier = t as { daysBefore?: number; percent?: number };
        return `${tier.percent ?? 0}% up to ${tier.daysBefore ?? 0} days before`;
      })
      .join("; ");
  }
  if (field === "photos" && Array.isArray(value)) return `${value.length} photo${value.length === 1 ? "" : "s"}`;
  if (field === "informationPdfs" && Array.isArray(value)) return `${value.length} PDF${value.length === 1 ? "" : "s"}`;
  if (field === "description" && typeof value === "string") {
    const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > 140 ? `${text.slice(0, 140)}…` : text;
  }
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : stableStringify(v))).join(", ");
  if (typeof value === "object") return stableStringify(value);
  return String(value);
}

/**
 * Events published before the change log existed have no baseline. The first
 * logged edit to one writes it from the stored row, before the edit's own row,
 * so the details athletes entered on are on record for those events too.
 */
export async function ensureBaseline(
  tx: Prisma.TransactionClient,
  event: { id: string; title: string; status: EventStatus } & Record<string, unknown>,
  organiserVerified: boolean,
): Promise<void> {
  const logged = await tx.eventChange.findFirst({ where: { eventId: event.id }, select: { id: true } });
  if (logged) return;
  await recordEventChange(tx, {
    eventId: event.id,
    eventTitle: event.title,
    source: "SYSTEM",
    kind: "BASELINE",
    organiserVerified,
    statusAtChange: event.status,
    changes: baselineChanges(event),
  });
}

export interface EventChangeHistoryEntry {
  id: string;
  kind: EventChangeKind;
  source: EventChangeSource;
  changedBy: string;
  createdAt: string;
  statusAtChange: EventStatus;
  material: boolean;
  affectedCount: number;
  fullRefundUntil: string | null;
  lines: { field: string; label: string; from: string; to: string; material: boolean }[];
}

/**
 * One change-log row as the history panel shows it. Organisers see "Startline"
 * for an admin's edit rather than the admin's own address; admins see who.
 */
export function serializeEventChange(
  row: {
    id: string; kind: EventChangeKind; source: EventChangeSource; changedByEmail: string | null;
    createdAt: Date; statusAtChange: EventStatus; material: boolean; affectedCount: number;
    fullRefundUntil: Date | null; changes: unknown;
  },
  audience: "organiser" | "admin",
): EventChangeHistoryEntry {
  const changedBy =
    row.source === "SYSTEM"
      ? "Startline (details on record before change logging began)"
      : row.source === "ADMIN" && audience === "organiser"
        ? "Startline"
        : row.changedByEmail ?? (row.source === "ADMIN" ? "Startline admin" : "Organiser");
  const changes = Array.isArray(row.changes) ? (row.changes as EventFieldChange[]) : [];
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    changedBy,
    createdAt: row.createdAt.toISOString(),
    statusAtChange: row.statusAtChange,
    material: row.material,
    affectedCount: row.affectedCount,
    fullRefundUntil: row.fullRefundUntil?.toISOString() ?? null,
    lines: changes.map((c) => ({
      field: c.field,
      label: c.label,
      from: describeChangeValue(c.field, c.from),
      to: describeChangeValue(c.field, c.to),
      material: c.material,
    })),
  };
}

/** Newest first. A baseline written in the same instant as an edit sorts after it. */
export const EVENT_CHANGE_HISTORY_ORDER = [
  { createdAt: "desc" as const },
  { kind: "desc" as const },
];
