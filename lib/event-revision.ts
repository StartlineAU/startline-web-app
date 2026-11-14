import type { EventRevisionStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { eventTimeData } from "@/lib/event-time";
import { effectiveEventStatus } from "@/lib/event-lifecycle";
import { withUniqueSlug } from "@/lib/slugs";
import { checkTeamTierChange } from "@/lib/team-entries";
import {
  baselineChanges,
  describeChangeValue,
  diffEventFields,
  ensureBaseline,
  materialChanges,
  recordEventChange,
  type EventFieldChange,
} from "@/lib/event-change-log";

/**
 * An unverified organiser's edit of a published event does not change the
 * public offer. It waits as a revision until an admin approves it. Verified
 * organisers, and every edit of an event that is not yet published, apply
 * immediately.
 */
export function publishedEditNeedsReview(verified: boolean, status: string): boolean {
  return !verified && status === "APPROVED";
}

export class RevisionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RevisionError";
  }
}

/** Drop keys the edit is not writing. JSON has no undefined. */
export function definedPayload(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export interface QueueEventRevisionInput {
  eventId: string;
  payload: Record<string, unknown>;
  changes: EventFieldChange[];
  submittedById: string;
  submittedByEmail: string;
}

/** Replace any open revision and store this one. The live event is not touched. */
export async function queueEventRevision(input: QueueEventRevisionInput) {
  return prisma.$transaction(async (tx) => {
    await tx.eventRevision.updateMany({
      where: { eventId: input.eventId, status: "PENDING" },
      data: { status: "SUPERSEDED" },
    });
    return tx.eventRevision.create({
      data: {
        eventId: input.eventId,
        payload: input.payload as Prisma.InputJsonValue,
        changes: input.changes as unknown as Prisma.InputJsonValue,
        material: input.changes.some((change) => change.material),
        submittedById: input.submittedById,
        submittedByEmail: input.submittedByEmail,
      },
      select: { id: true },
    });
  });
}

export async function supersedePendingRevision(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<number> {
  const result = await tx.eventRevision.updateMany({
    where: { eventId, status: "PENDING" },
    data: { status: "SUPERSEDED" },
  });
  return result.count;
}

export interface RevisionLine {
  field: string;
  label: string;
  from: string;
  to: string;
  material: boolean;
}

export interface SerializedRevision {
  id: string;
  status: EventRevisionStatus;
  material: boolean;
  submittedAt: string;
  submittedBy: string | null;
  rejectionReason: string | null;
  lines: RevisionLine[];
  payload: Record<string, unknown>;
}

export function serializeRevision(row: {
  id: string;
  status: EventRevisionStatus;
  material: boolean;
  createdAt: Date;
  submittedByEmail: string | null;
  rejectionReason: string | null;
  changes: unknown;
  payload: unknown;
}): SerializedRevision {
  const changes = Array.isArray(row.changes) ? (row.changes as EventFieldChange[]) : [];
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? (row.payload as Record<string, unknown>)
    : {};
  return {
    id: row.id,
    status: row.status,
    material: row.material,
    submittedAt: row.createdAt.toISOString(),
    submittedBy: row.submittedByEmail,
    rejectionReason: row.rejectionReason,
    payload,
    lines: changes.map((change) => ({
      field: change.field,
      label: change.label,
      from: describeChangeValue(change.field, change.from),
      to: describeChangeValue(change.field, change.to),
      material: change.material,
    })),
  };
}

const revisionSelect = {
  id: true,
  status: true,
  material: true,
  createdAt: true,
  submittedByEmail: true,
  submittedById: true,
  rejectionReason: true,
  changes: true,
  payload: true,
} as const;

export async function pendingRevision(eventId: string) {
  const row = await prisma.eventRevision.findFirst({
    where: { eventId, status: "PENDING" },
    select: revisionSelect,
    orderBy: { createdAt: "desc" },
  });
  return row ? serializeRevision(row) : null;
}

export async function discardPendingRevision(eventId: string): Promise<boolean> {
  const result = await prisma.eventRevision.updateMany({
    where: { eventId, status: "PENDING" },
    data: { status: "SUPERSEDED" },
  });
  return result.count > 0;
}

export interface ApplyRevisionResult {
  eventId: string;
  title: string;
  changeId: string;
  changes: EventFieldChange[];
  updated: { id: string; status: string; startsAtUtc: Date | null; endsAtUtc: Date | null };
}

/**
 * Apply the open revision onto the live event. The diff is recomputed against
 * the row as it is now, not the snapshot from submit time.
 */
export async function applyPendingRevision(input: {
  eventId: string;
  reviewedById: string;
}): Promise<ApplyRevisionResult> {
  const pending = await prisma.eventRevision.findFirst({
    where: { eventId: input.eventId, status: "PENDING" },
    select: revisionSelect,
  });
  if (!pending) {
    throw new RevisionError("There is no edit waiting for review.", 409, "NO_PENDING_REVISION");
  }

  const existing = await prisma.event.findUnique({ where: { id: input.eventId } });
  if (!existing) throw new RevisionError("Event not found.", 404, "NOT_FOUND");

  const payload = pending.payload && typeof pending.payload === "object" && !Array.isArray(pending.payload)
    ? (pending.payload as Record<string, unknown>)
    : {};
  const merged = { ...existing, ...payload } as typeof existing & Record<string, unknown>;

  // Entries may have been taken on a team ticket while this edit waited for
  // review; its team size is fixed once they have.
  const teamTierError = await checkTeamTierChange(input.eventId, existing, {
    waves: payload.waves,
    format: typeof payload.format === "string" ? payload.format : undefined,
  });
  if (teamTierError) throw new RevisionError(teamTierError, 409, "TEAM_TICKET_CHANGED");

  const times = eventTimeData({
    eventDate: String(merged.eventDate ?? existing.eventDate),
    endDate: merged.endDate !== undefined ? (merged.endDate as string | null) : existing.endDate,
    startTime: String(merged.startTime ?? existing.startTime),
    endTime: merged.endTime !== undefined ? (merged.endTime as string | null) : existing.endTime,
    state: String(merged.state ?? existing.state),
  });
  const nextStatus = effectiveEventStatus({ status: "APPROVED", ...times });
  const changes = diffEventFields(existing as unknown as Record<string, unknown>, payload);
  const material = materialChanges(changes);

  const renamed = typeof payload.title === "string" && payload.title !== existing.title;
  const changeId = pending.id;

  const write = async (slug: string | undefined) => prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM event_revisions
      WHERE id = ${pending.id} AND status = 'PENDING'::"EventRevisionStatus"
      FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new RevisionError("This edit has already been reviewed.", 409, "NO_PENDING_REVISION");
    }

    const updated = await tx.event.update({
      where: { id: existing.id },
      data: {
        ...(slug ? { slug } : {}),
        ...times,
        ...(payload as Prisma.EventUpdateInput),
        status: nextStatus,
      },
    });

    if (changes.length > 0) {
      await ensureBaseline(
        tx,
        existing as unknown as Parameters<typeof ensureBaseline>[1],
        false,
      );
      await recordEventChange(tx, {
        id: changeId,
        eventId: existing.id,
        eventTitle: updated.title,
        source: "ORGANISER",
        kind: "EDIT",
        changedById: pending.submittedById,
        changedByEmail: pending.submittedByEmail,
        organiserVerified: false,
        statusAtChange: existing.status,
        changes,
      });
    }

    await tx.eventRevision.update({
      where: { id: pending.id },
      data: {
        status: "APPROVED",
        reviewedById: input.reviewedById,
        reviewedAt: new Date(),
        changes: changes as unknown as Prisma.InputJsonValue,
        material: material.length > 0,
      },
    });

    return updated;
  });

  const updated = renamed
    ? await withUniqueSlug(String(payload.title), write, { excludeId: existing.id })
    : await write(undefined);

  return {
    eventId: updated.id,
    title: updated.title,
    changeId,
    changes: material,
    updated,
  };
}

export async function rejectPendingRevision(input: {
  eventId: string;
  reviewedById: string;
  reason: string;
}): Promise<{ title: string }> {
  const reason = input.reason.trim();
  if (!reason) throw new RevisionError("A rejection reason is required.", 400, "REASON_REQUIRED");

  const pending = await prisma.eventRevision.findFirst({
    where: { eventId: input.eventId, status: "PENDING" },
    select: { id: true, event: { select: { title: true } } },
  });
  if (!pending) {
    throw new RevisionError("There is no edit waiting for review.", 409, "NO_PENDING_REVISION");
  }

  const claimed = await prisma.eventRevision.updateMany({
    where: { id: pending.id, status: "PENDING" },
    data: {
      status: "REJECTED",
      reviewedById: input.reviewedById,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });
  if (claimed.count === 0) {
    throw new RevisionError("This edit has already been reviewed.", 409, "NO_PENDING_REVISION");
  }
  return { title: pending.event.title };
}
