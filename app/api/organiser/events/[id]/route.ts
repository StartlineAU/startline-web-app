import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { getEventCoords } from "@/lib/australia-coords";
import { notifyAdminsEventSubmitted } from "@/lib/notify-admins-event-submitted";
import { notifyOrganiserFollowers } from "@/lib/notify-organiser-followers";
import { eventPayloadSchema, idParams } from "@/lib/schemas";
import { withUniqueSlug } from "@/lib/slugs";
import { hasAbn, ABN_REQUIRED_MESSAGE } from "@/lib/abn";
import { eventTimeData } from "@/lib/event-time";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { effectiveEventStatus, type PersistedEventStatus } from "@/lib/event-lifecycle";
import { cancelEventSchedules, syncEventSchedules } from "@/lib/event-scheduler";
import { takesPayments } from "@/lib/event-approval";
import {
  isLiveEventStatus, organiserCanEditEvent, organiserEditBlockedMessage,
} from "@/lib/event-edit-policy";
import {
  MATERIAL_FIELD_GROUPS, baselineChanges, diffEventFields,
  ensureBaseline, materialChanges, recordEventChange,
} from "@/lib/event-change-log";
import { notifyEventChange } from "@/lib/notify-event-change";
import { notifyAdminsEventEditPending } from "@/lib/notify-event-revision";
import {
  definedPayload, pendingRevision, publishedEditNeedsReview, queueEventRevision,
} from "@/lib/event-revision";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // What the wizard needs to warn before an edit rather than after it: how
    // many athletes have entered and would be emailed about a material change.
    const enteredCount = event.status === "DRAFT"
      ? 0
      : await prisma.registration.count({ where: { eventId: id, status: "CONFIRMED" } });
    const revision = event.status === "APPROVED" ? await pendingRevision(id) : null;

    return NextResponse.json({
      ...event,
      // The editor writes this into the page as HTML. Rows saved before
      // descriptions were sanitised on write may still carry markup.
      description: event.description != null ? sanitizeHtml(event.description) : null,
      editContext: {
        enteredCount,
        materialFields: MATERIAL_FIELD_GROUPS,
        needsReview: publishedEditNeedsReview(session.verified, event.status),
        pendingRevision: revision,
      },
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

const REQUIRED_ON_SUBMIT = ["title", "discipline", "eventDate", "startTime", "city", "state", "format", "level"] as const;

// PATCH /api/organiser/events/[id] — edit an event the organiser may still edit
// (see lib/event-edit-policy.ts). Every edit after the event first leaves DRAFT
// is written to the event change log in the same transaction as the edit.
//
// A material change (date, time, location or event type) is recorded and the
// athletes already entered are emailed. There is no automatic refund: anyone
// affected raises it through Support, which the organiser and Startline review.
//
// An unverified organiser's edit of a live event is stored as a revision and an
// admin approves it before the listing changes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

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
    const existing = await prisma.event.findUnique({ where: { id } });

    if (!existing)
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (existing.organiserId !== session.sub)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // The stored status can lag a due lifecycle transition. Judge what the
    // event is now, not what it was at the last scheduler tick.
    const currentStatus = effectiveEventStatus({
      status: existing.status,
      ...eventTimeData(existing),
    });
    if (!organiserCanEditEvent(currentStatus))
      return NextResponse.json(
        { error: organiserEditBlockedMessage(currentStatus) },
        { status: 409 },
      );

    // Judge required fields on the event as it will be once written. A partial
    // payload (the event page's "Submit for review" sends only `submit`) keeps
    // every saved value, so it must not be refused for fields it left out.
    if (submit) {
      const provided = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
      const merged = { ...existing, ...provided } as Record<string, unknown>;
      for (const field of REQUIRED_ON_SUBMIT) {
        if (!merged[field]) return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
      }
      if (merged.registrationType === "external" && !merged.registrationUrl) {
        return NextResponse.json({ error: "registrationUrl is required for external registrations." }, { status: 400 });
      }
    }

    // See the create route: a missing ABN costs the event its auto-approval
    // rather than rejecting the edit and stranding the organiser's changes. An
    // edit that leaves a field out keeps the saved value, so judge what the
    // event will be once it is written.
    let abnOk = true;
    if (takesPayments(data.registrationType ?? existing.registrationType, data.waves ?? existing.waves)) {
      const org = await prisma.organiser.findUnique({
        where: { id: session.sub },
        select: { abn: true },
      });
      abnOk = hasAbn(org?.abn);
    }

    // A draft can still auto-publish. An event already in review stays there,
    // and a rejected event re-enters review on resubmission rather than
    // bypassing the decision that rejected it. A live event stays live: an
    // edit never sends it back to review or takes it off sale. Saving without
    // submitting keeps the event where it is; it must never demote a pending,
    // rejected or live event back to DRAFT.
    const live = isLiveEventStatus(currentStatus);
    const nextStatus: PersistedEventStatus = !submit || live
      ? currentStatus
      : existing.status === "PENDING" || existing.status === "REJECTED"
        ? "PENDING"
        : session.verified && abnOk
          ? "APPROVED"
          : "PENDING";

    const times = eventTimeData({
      eventDate: data.eventDate ?? existing.eventDate,
      endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
      startTime: data.startTime ?? existing.startTime,
      endTime: data.endTime !== undefined ? data.endTime : existing.endTime,
      state: data.state ?? existing.state,
    });
    const lifecycleStatus = effectiveEventStatus({ status: nextStatus, ...times });

    // Fields the payload leaves out are not written. That used to be true of
    // every field except cap and the map pin, which a partial save wiped.
    const coords = data.city && data.state ? getEventCoords(data.city, data.state) : null;
    const fields = {
      title:             data.title             ?? undefined,
      discipline:        data.discipline        ?? undefined,
      description:       data.description != null ? sanitizeHtml(data.description) : undefined,
      eventDate:         data.eventDate         ?? undefined,
      endDate:           data.endDate !== undefined ? data.endDate : undefined,
      startTime:         data.startTime         ?? undefined,
      endTime:           data.endTime           ?? undefined,
      venue:             data.venue             ?? undefined,
      address:           data.address           ?? undefined,
      city:              data.city              ?? undefined,
      state:             data.state             ?? undefined,
      latitude:          data.latitude          ?? (coords ? coords[0] : undefined),
      longitude:         data.longitude         ?? (coords ? coords[1] : undefined),
      format:            data.format            ?? undefined,
      level:             data.level             ?? undefined,
      categories:        (data.categories ?? undefined) as Prisma.InputJsonValue | undefined,
      cap:               data.cap !== undefined ? data.cap : undefined,
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

    // ── Change log and the material-change handshake ──────────────────────
    // Drafts have no audience, so their edits are not logged. The edit that
    // takes an event out of DRAFT writes the baseline: the "original
    // information". Every edit after that writes the fields it changed.
    const wasDraft = existing.status === "DRAFT";
    const leavingDraft = wasDraft && lifecycleStatus !== "DRAFT";
    const changes = wasDraft
      ? []
      : diffEventFields(existing as unknown as Record<string, unknown>, fields as Record<string, unknown>);
    const material = materialChanges(changes);

    // An unverified organiser's edit of a published event does not change the
    // listing. It waits for an admin. Athletes keep seeing the last approved offer.
    if (publishedEditNeedsReview(session.verified, currentStatus) && changes.length > 0) {
      const revision = await queueEventRevision({
        eventId: id,
        payload: definedPayload(fields as Record<string, unknown>),
        changes,
        submittedById: session.sub,
        submittedByEmail: auth.actorEmail ?? session.email,
      });
      await notifyAdminsEventEditPending({ eventId: id, changes })
        .catch((err) => console.error("Event edit review notify failed:", err));
      return NextResponse.json({
        id,
        status: existing.status,
        pendingReview: true,
        revisionId: revision.id,
      });
    }

    // Only a rename reassigns the slug; every other edit leaves it alone so links
    // already in the wild keep resolving, and skips the lookup entirely.
    const renamed = data.title !== undefined && data.title !== existing.title;
    const changeId = randomUUID();

    // One transaction per attempt: the edit and the log row land together or not
    // at all. withUniqueSlug retries a slug clash with a fresh transaction, so a
    // rolled-back attempt leaves nothing behind.
    const runUpdate = (slug: string | undefined) =>
      prisma.$transaction(async (tx) => {
        const updated = await tx.event.update({
          where: { id },
          data: { slug, ...times, ...fields, status: lifecycleStatus },
        });

        if (!wasDraft && changes.length > 0) {
          await ensureBaseline(tx, existing as unknown as Parameters<typeof ensureBaseline>[1], session.verified);
        }
        if (leavingDraft || changes.length > 0) {
          await recordEventChange(tx, {
            id: changeId,
            eventId: id,
            eventTitle: updated.title,
            source: "ORGANISER",
            kind: leavingDraft ? "BASELINE" : "EDIT",
            changedById: session.sub,
            changedByEmail: auth.actorEmail ?? session.email,
            organiserVerified: session.verified,
            statusAtChange: currentStatus,
            changes: leavingDraft
              ? baselineChanges(updated as unknown as Record<string, unknown>)
              : changes,
          });
        }

        return updated;
      });

    const updated = renamed
      ? await withUniqueSlug(data.title!, runUpdate, { excludeId: id })
      : await runUpdate(undefined);

    await syncEventSchedules(updated).catch((err) =>
      console.error("Event lifecycle schedule sync failed:", err),
    );

    // Only a draft can auto-publish, so this is the moment it goes live.
    if (wasDraft && nextStatus === "APPROVED") {
      // Awaited, not fired and forgotten: Amplify's compute freezes the
      // container once the response is returned, so a floating promise is
      // dropped at random. A notify failure still must not fail the publish.
      await prisma.organiser
        .findUnique({ where: { id: updated.organiserId }, select: { orgName: true } })
        .then((org) =>
          notifyOrganiserFollowers({
            organiserId: updated.organiserId,
            eventId: updated.id,
            eventTitle: updated.title,
            organiserName: org?.orgName,
            eventDate: updated.eventDate || null,
            city: updated.city || null,
          }),
        )
        .catch((err) => console.error("Follower notify failed:", err));
    }

    // Notify only when the event enters the review queue, not on every edit to
    // an event that is already waiting there.
    if (updated.status === "PENDING" && existing.status !== "PENDING") {
      await notifyAdminsEventSubmitted(updated.id)
        .catch((err) => console.error("Admin review notify failed:", err));
    }

    // Entrants are told what changed. There is no automatic refund: anything
    // they are owed is raised through Support and reviewed. An unverified
    // organiser's edit never reaches here; it is queued for review above.
    if (material.length > 0) {
      await notifyEventChange({
        eventId: updated.id,
        changes: material,
      }).catch((err) => console.error("Event change notify failed:", err));
    }

    return NextResponse.json({
      id:     updated.id,
      status: updated.status,
      ...(submit && !abnOk && !live ? { abnRequired: true, notice: ABN_REQUIRED_MESSAGE } : {}),
    });
  } catch (err) {
    console.error("Event update error:", err);
    return NextResponse.json({ error: "Failed to update event." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;
  if (session.role !== "OWNER") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const existing = await prisma.event.findUnique({
      where:  { id },
      select: { organiserId: true },
    });

    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    await prisma.event.delete({ where: { id } });
    await cancelEventSchedules(id).catch((err) =>
      console.error("Event schedule cleanup failed:", err),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Event delete error:", err);
    return NextResponse.json({ error: "Failed to delete event." }, { status: 500 });
  }
}
