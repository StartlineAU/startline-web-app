import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { getEventCoords } from "@/lib/australia-coords";
import { writeAuditLog } from "@/lib/audit";
import { eventPayloadSchema, idParams } from "@/lib/schemas";
import { eventTimeData } from "@/lib/event-time";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { tidyLocationText } from "@/lib/event-location";
import { checkEventLocation } from "@/lib/event-location-verify";
import { effectiveEventStatus } from "@/lib/event-lifecycle";
import { cancelEventSchedules, syncEventSchedules } from "@/lib/event-scheduler";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  baselineChanges, diffEventFields,
  ensureBaseline, materialChanges, recordEventChange,
} from "@/lib/event-change-log";
import { notifyEventChange } from "@/lib/notify-event-change";
import { supersedePendingRevision } from "@/lib/event-revision";
import { notifyOrganiserRevisionSuperseded } from "@/lib/notify-event-revision";

const AUDIT_FIELDS = [
  "title", "discipline", "description", "eventDate", "endDate", "startTime", "endTime",
  "venue", "address", "city", "state", "latitude", "longitude", "format", "level",
  "categories", "cap", "minAge", "waves", "inclusions", "extras", "activations",
  "refundTiers", "refundPolicy", "registrationType", "feeStructure", "registrationUrl",
  "accessibilityInfo", "coverImageUrl", "informationPdfs", "photos", "status",
] as const;

function auditChanges(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of AUDIT_FIELDS) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }
  return changes;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
    // The editor writes this into the admin's page as HTML, and an organiser
    // wrote it. Rows saved before sanitise-on-write may still carry markup.
    return NextResponse.json({
      ...event,
      description: event.description != null ? sanitizeHtml(event.description) : null,
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// PATCH /api/admin/events/[id] — edit any event, regardless of status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const raw: unknown = await req.json().catch(() => null);
  const parsedBody = eventPayloadSchema.safeParse(raw);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const body = parsedBody.data;
  const { submit, ...data } = body;

  try {
    const existing = await prisma.event.findUnique({
      where: { id },
      include: { organiser: { select: { verified: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (submit) {
      const required = ["title", "discipline", "eventDate", "startTime", "city", "state", "format", "level"] as const;
      for (const field of required) {
        if (!data[field]) return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
      }
      if (data.registrationType === "external" && !data.registrationUrl) {
        return NextResponse.json({ error: "registrationUrl is required for external registrations." }, { status: 400 });
      }
    }

    // A real place, not spaces or symbols (#530).
    const locationError = await checkEventLocation(data, { submit, saved: existing });
    if (locationError) return NextResponse.json({ error: locationError }, { status: 400 });

    // Live events stay live after an admin edit; everything else re-enters the
    // review queue. Archived events stay archived rather than reopening.
    const submittedAs = submit
      ? existing.status === "APPROVED" || existing.status === "IN_PROGRESS"
        ? "APPROVED"
        : existing.status === "ARCHIVED"
          ? "ARCHIVED"
          : "PENDING"
      : existing.status;

    const times = eventTimeData({
      eventDate: data.eventDate ?? existing.eventDate,
      endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
      startTime: data.startTime ?? existing.startTime,
      endTime: data.endTime !== undefined ? data.endTime : existing.endTime,
      state: data.state ?? existing.state,
    });
    const nextStatus = effectiveEventStatus({ status: submittedAs, ...times });

    const fields = {
      title:             data.title             ?? undefined,
      discipline:        data.discipline        ?? undefined,
      description:       data.description != null ? sanitizeHtml(data.description) : undefined,
      eventDate:         data.eventDate         ?? undefined,
      endDate:           data.endDate !== undefined ? data.endDate : undefined,
      startTime:         data.startTime         ?? undefined,
      endTime:           data.endTime           ?? undefined,
      venue:             data.venue   != null ? tidyLocationText(data.venue) : undefined,
      address:           data.address != null ? tidyLocationText(data.address) || null : undefined,
      city:              data.city    != null ? tidyLocationText(data.city) : undefined,
      state:             data.state             ?? undefined,
      latitude:          data.latitude          ?? (data.city && data.state ? getEventCoords(data.city, data.state)[0] : null),
      longitude:         data.longitude         ?? (data.city && data.state ? getEventCoords(data.city, data.state)[1] : null),
      format:            data.format            ?? undefined,
      level:             data.level             ?? undefined,
      categories:        (data.categories ?? undefined) as Prisma.InputJsonValue | undefined,
      cap:               data.cap               ?? null,
      minAge:            data.minAge            ?? undefined,
      waves:             (data.waves ?? undefined) as Prisma.InputJsonValue | undefined,
      inclusions:        data.inclusions        ?? undefined,
      extras:            data.extras            ?? undefined,
      activations:       data.activations       ?? undefined,
      refundTiers:       data.refundTiers       ?? undefined,
      refundPolicy:      data.refundPolicy      ?? undefined,
      registrationType:  data.registrationType  ?? undefined,
      feeStructure:      data.feeStructure      ?? undefined,
      registrationUrl:   data.registrationUrl   ?? undefined,
      accessibilityInfo: data.accessibilityInfo ?? undefined,
      coverImageUrl:     data.coverImageUrl     ?? undefined,
      informationPdfs:   data.informationPdfs === undefined ? undefined : data.informationPdfs,
      photos:            Array.isArray(data.photos) ? data.photos : undefined,
    };

    // Same change log as an organiser edit (app/api/organiser/events/[id]/route.ts).
    // An admin moving the date of an event athletes have paid for is no less a
    // change for those athletes: it is recorded and they are emailed.
    const wasDraft = existing.status === "DRAFT";
    const leavingDraft = wasDraft && nextStatus !== "DRAFT";
    const changes = wasDraft
      ? []
      : diffEventFields(existing as unknown as Record<string, unknown>, fields as Record<string, unknown>);
    const material = materialChanges(changes);

    const changeId = randomUUID();
    let superseded = 0;
    const updated = await prisma.$transaction(async (tx) => {
      // A direct admin edit is the review. A queued organiser revision would
      // otherwise apply on top of it and overwrite this change.
      superseded = await supersedePendingRevision(tx, id);
      const updated = await tx.event.update({
        where: { id },
        data: { ...times, ...fields, status: nextStatus },
      });

      if (!wasDraft && changes.length > 0) {
        await ensureBaseline(tx, existing as unknown as Parameters<typeof ensureBaseline>[1], existing.organiser.verified);
      }
      if (leavingDraft || changes.length > 0) {
        await recordEventChange(tx, {
          id: changeId,
          eventId: id,
          eventTitle: updated.title,
          source: "ADMIN",
          kind: leavingDraft ? "BASELINE" : "EDIT",
          changedById: session.sub,
          changedByEmail: session.email,
          organiserVerified: existing.organiser.verified,
          statusAtChange: existing.status,
          changes: leavingDraft
            ? baselineChanges(updated as unknown as Record<string, unknown>)
            : changes,
        });
      }

      return updated;
    });

    if (superseded > 0) {
      await notifyOrganiserRevisionSuperseded(id)
        .catch((err) => console.error("Revision superseded notify failed:", err));
    }

    if (material.length > 0) {
      await notifyEventChange({
        eventId: updated.id,
        changes: material,
      }).catch((err) => console.error("Event change notify failed:", err));
    }

    await syncEventSchedules(updated).catch((err) =>
      console.error("Event lifecycle schedule sync failed:", err),
    );

    const auditDiff = auditChanges(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );

    await writeAuditLog({
      adminId: session.sub,
      action: "EDIT_EVENT",
      targetType: "event",
      targetId: id,
      meta: {
        title: updated.title,
        status: nextStatus,
        changedFields: Object.keys(auditDiff),
        changes: auditDiff,
      },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error("Admin event update error:", err);
    return NextResponse.json({ error: "Failed to update event." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    await prisma.event.delete({ where: { id } });
    await cancelEventSchedules(id).catch((err) =>
      console.error("Event schedule cleanup failed:", err),
    );

    writeAuditLog({
      adminId: session.sub,
      action: "DELETE_EVENT",
      targetType: "event",
      targetId: id,
      meta: { title: event.title, status: event.status },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin delete event error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
