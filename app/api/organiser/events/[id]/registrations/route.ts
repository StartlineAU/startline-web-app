import { NextRequest, NextResponse } from "next/server";
import { entryBib, holdsTeamPlace } from "@/lib/team-entries";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { wavesWithCounts } from "@/lib/start-waves";
import type { RegistrationStatus, Prisma } from "@prisma/client";
import { idParams } from "@/lib/schemas";
import { z } from "zod";
import { getCapacityError } from "@/lib/registration-capacity";
import { confirmedUnitsByWave } from "@/lib/team-tickets";
import { lockEventEntries } from "@/lib/event-entry-lock";
import { isFreeEntry, organiserStatusChange } from "@/lib/registration-status-policy";
import { findOrganiserBlock } from "@/lib/organiser-blocks";
import { entryPaidCents } from "@/lib/stripe-refunds";

const registrationPatchRowSchema = z.object({
  registrationId: z.string().min(1).max(255),
  startWaveId: z.string().max(255).nullable().optional(),
  startWaveLabel: z.string().max(255).nullable().optional(),
  bibNumber: z.string().max(50).nullable().optional(),
  // REMOVED is accepted only so the edit dialog can send an entry's current
  // status back unchanged; organiserStatusChange refuses any move to it.
  status: z.enum(["CONFIRMED", "REFUND_REQUESTED", "REFUNDED", "CANCELLED", "REMOVED"]).optional(),
  estimatedFinishMinutes: z.number().int().min(0).nullable().optional(),
});

const registrationPatchSchema = z.object({
  // An event's whole field in one save (wave sorting) stays well under this.
  registrations: z.array(registrationPatchRowSchema).min(1).max(5000),
});

async function assertOwnedEvent(eventId: string, organiserId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organiserId: true, waves: true, title: true, cap: true },
  });
  if (!event) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  if (event.organiserId !== organiserId) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { event };
}

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
  const owned = await assertOwnedEvent(id, session.sub);
  if (owned.error) return owned.error;

  const registrations = await prisma.registration.findMany({
    where: { eventId: id },
    orderBy: [{ athleteName: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      athleteName: true,
      athleteEmail: true,
      category: true,
      waveLabel: true,
      startWaveId: true,
      startWaveLabel: true,
      waveNotifiedLabel: true,
      bibNumber: true,
      gender: true,
      dateOfBirth: true,
      estimatedFinishMinutes: true,
      medicalNotes: true,
      status: true,
      checkedInAt: true,
      amountCents: true,
      platformFeeCents: true,
      feeStructure: true,
      stripePaymentIntentId: true,
      refundAmountCents: true,
      refundPercent: true,
      refundRequestedAt: true,
      refundOutsidePolicy: true,
      createdAt: true,
      resultDistance: true,
      resultTime: true,
      resultPlacement: true,
      isPersonalBest: true,
      isTopResult: true,
      teamId: true,
      detailsPending: true,
      team: { select: { id: true, name: true, size: true, bibNumber: true, captainRegistrationId: true } },
    },
  });

  const waves = (owned.event!.waves as { label: string; price: string; qty?: number }[]) ?? [];
  const startWaves = await wavesWithCounts(id);

  return NextResponse.json({
    event: {
      id: owned.event!.id,
      title: owned.event!.title,
      waves,
      startWaves,
    },
    registrations: registrations.map((r) => ({
      id: r.id,
      name: r.athleteName,
      email: r.athleteEmail,
      category: r.category,
      waveId: r.startWaveId,
      wave: r.startWaveLabel,
      tier: r.waveLabel,
      waveNotified: r.waveNotifiedLabel,
      // A team member carries the team's bib.
      bibNumber: entryBib(r),
      // A team place bought "details later": the buyer has not named its member yet.
      detailsPending: r.detailsPending,
      team: r.team
        ? {
            id: r.team.id,
            name: r.team.name,
            size: r.team.size,
            captain: r.team.captainRegistrationId === r.id,
          }
        : null,
      gender: r.gender,
      dateOfBirth: r.dateOfBirth,
      estimatedFinishMinutes: r.estimatedFinishMinutes,
      medicalNotes: r.medicalNotes,
      status: r.status,
      checkedInAt: r.checkedInAt,
      // Paid is the ticket price; refund due comes from the frozen snapshot so the
      // organiser sees the same figure the athlete was quoted.
      amount: (r.amountCents + r.platformFeeCents) / 100,
      refundAmountCents: r.refundAmountCents,
      refundPercent: r.refundPercent,
      refundRequestedAt: r.refundRequestedAt,
      refundOutsidePolicy: r.refundOutsidePolicy,
      createdAt: r.createdAt,
      // Only a free entry's status is the organiser's to change; see
      // lib/registration-status-policy.ts.
      statusEditable: isFreeEntry(r),
      // What Remove from event would send back (#571): everything this entry
      // paid through Startline, or 0 when nothing was charged.
      removalRefundCents: r.stripePaymentIntentId ? entryPaidCents(r) : 0,
      resultDistance: r.resultDistance,
      resultTime: r.resultTime,
      resultPlacement: r.resultPlacement,
      isPersonalBest: r.isPersonalBest,
      isTopResult: r.isTopResult,
    })),
  });
}

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
  const owned = await assertOwnedEvent(id, session.sub);
  if (owned.error) return owned.error;

  const parsedBody = registrationPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "registrations array is required." }, { status: 400 });
  }
  const rows = parsedBody.data.registrations;

  // Resolve wave references against the StartWave table. We accept either an id
  // (preferred) or a label (from older callers) and write both columns in step.
  const startWaves = await prisma.startWave.findMany({
    where: { eventId: id },
    select: { id: true, label: true },
  });
  const idToLabel = new Map(startWaves.map((w) => [w.id, w.label]));
  const labelToId = new Map(startWaves.map((w) => [w.label.toLowerCase(), w.id]));

  const existing = await prisma.registration.findMany({
    where: { eventId: id },
    select: {
      id: true, bibNumber: true, teamId: true, status: true, waveLabel: true,
      amountCents: true, platformFeeCents: true, stripePaymentIntentId: true,
      userId: true, athleteEmail: true,
    },
  });
  const byId = new Map(existing.map((r) => [r.id, r]));
  const teams = await prisma.team.findMany({
    where: { eventId: id },
    select: { id: true, bibNumber: true },
  });
  const membersByTeam = new Map<string, string[]>();
  // Members still holding a place; a cancelled or refunded one is left alone.
  for (const r of existing) {
    if (!r.teamId || !holdsTeamPlace(r.status)) continue;
    membersByTeam.set(r.teamId, [...(membersByTeam.get(r.teamId) ?? []), r.id]);
  }

  // A bib belongs to an entry, or to a whole team: a team member's bib is the
  // team's. Owners are keyed so the two never collide: "team:<id>" or the
  // registration id. Tracked through the batch to catch intra-batch clashes.
  const ownerKey = (registrationId: string) => {
    const teamId = byId.get(registrationId)?.teamId;
    return teamId ? `team:${teamId}` : registrationId;
  };
  const bibOwner = new Map<string, string>();
  for (const r of existing) {
    if (!r.teamId && r.bibNumber?.trim()) bibOwner.set(r.bibNumber.trim(), r.id);
  }
  for (const t of teams) {
    if (t.bibNumber?.trim()) bibOwner.set(t.bibNumber.trim(), `team:${t.id}`);
  }
  const teamBibUpdates = new Map<string, string | null>();

  const updates: { id: string; data: Prisma.RegistrationUncheckedUpdateInput }[] = [];
  // Cancelled free entries being reinstated, which take capacity back.
  const reinstated: { id: string; waveLabel: string | null; teamId: string | null }[] = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    if (!row.registrationId || !byId.has(row.registrationId)) {
      unmatched.push(row.registrationId ?? "unknown");
      continue;
    }

    const data: Prisma.RegistrationUncheckedUpdateInput = {};

    if ("startWaveId" in row) {
      const wid = row.startWaveId?.trim() || null;
      if (wid && !idToLabel.has(wid)) {
        return NextResponse.json({ error: "Unknown start wave." }, { status: 400 });
      }
      data.startWaveId = wid;
      data.startWaveLabel = wid ? idToLabel.get(wid)! : null;
    } else if ("startWaveLabel" in row) {
      const label = row.startWaveLabel?.trim() || null;
      if (label && !labelToId.has(label.toLowerCase())) {
        return NextResponse.json({ error: `Unknown start wave "${label}".` }, { status: 400 });
      }
      data.startWaveId = label ? labelToId.get(label.toLowerCase())! : null;
      data.startWaveLabel = label ? idToLabel.get(labelToId.get(label.toLowerCase())!)! : null;
    }

    if ("bibNumber" in row) {
      const bib = row.bibNumber?.trim() || null;
      const key = ownerKey(row.registrationId);
      if (bib) {
        const owner = bibOwner.get(bib);
        if (owner && owner !== key) {
          return NextResponse.json(
            { error: `Bib ${bib} is already assigned.` },
            { status: 409 }
          );
        }
      }
      // Release this owner's previous bib, then take the new one.
      for (const [b, ownerId] of bibOwner) {
        if (ownerId === key) bibOwner.delete(b);
      }
      if (bib) bibOwner.set(bib, key);
      const teamId = byId.get(row.registrationId)?.teamId;
      if (teamId) teamBibUpdates.set(teamId, bib);
      else data.bibNumber = bib;
    }

    if ("status" in row && row.status != null) {
      const current = byId.get(row.registrationId)!;
      const decision = organiserStatusChange(current, row.status as RegistrationStatus);
      if (!decision.ok) {
        return NextResponse.json({ error: decision.error, code: "STATUS_LOCKED" }, { status: 403 });
      }
      if (decision.change) {
        data.status = row.status as RegistrationStatus;
        if (decision.reinstating) reinstated.push({ id: row.registrationId, waveLabel: current.waveLabel, teamId: current.teamId });
      }
    }

    if ("estimatedFinishMinutes" in row) {
      const mins = row.estimatedFinishMinutes;
      if (mins != null && (!Number.isInteger(mins) || mins < 0)) {
        return NextResponse.json({ error: "estimatedFinishMinutes must be a non-negative integer." }, { status: 400 });
      }
      data.estimatedFinishMinutes = mins ?? null;
    }

    if (Object.keys(data).length === 0) continue;
    updates.push({ id: row.registrationId, data });

    // A team starts together: a start wave set on one member moves them all.
    const teamId = byId.get(row.registrationId)?.teamId;
    if (teamId && "startWaveId" in data) {
      for (const mate of membersByTeam.get(teamId) ?? []) {
        if (mate === row.registrationId) continue;
        updates.push({ id: mate, data: { startWaveId: data.startWaveId, startWaveLabel: data.startWaveLabel } });
      }
    }
  }

  if (updates.length > 0 || teamBibUpdates.size > 0) {
    const event = owned.event!;
    const capacityError = await prisma.$transaction(async (tx) => {
      if (reinstated.length > 0) {
        // Reinstating takes a place, so it obeys the same cap as a new entry
        // and the same lock as the checkout confirmation.
        await lockEventEntries(tx, id);
        const waves = Array.isArray(event.waves) ? (event.waves as { label: string; qty?: number }[]) : [];
        const [confirmedTotal, grouped] = await Promise.all([
          tx.registration.count({ where: { eventId: id, status: "CONFIRMED" } }),
          tx.registration.groupBy({
            by: ["waveLabel", "teamId"],
            where: { eventId: id, status: "CONFIRMED" },
            _count: { _all: true },
          }),
        ]);
        const confirmedByWave = confirmedUnitsByWave(grouped);
        // A tier counts a team once. A member rejoining a team that still has
        // a confirmed member takes no tier place; the first back takes one.
        const confirmedTeams = new Set(grouped.map((g) => g.teamId).filter(Boolean));
        const teamsCounted = new Set<string>();
        const requestedByWave: Record<string, number> = {};
        for (const r of reinstated) {
          if (!r.waveLabel) continue;
          if (r.teamId) {
            if (confirmedTeams.has(r.teamId) || teamsCounted.has(r.teamId)) continue;
            teamsCounted.add(r.teamId);
          }
          requestedByWave[r.waveLabel] = (requestedByWave[r.waveLabel] ?? 0) + 1;
        }
        const error = getCapacityError({
          cap: event.cap,
          confirmedTotal,
          requestedTotal: reinstated.length,
          waves,
          usedLabels: [...new Set(reinstated.map((r) => r.waveLabel).filter((l): l is string => !!l))],
          confirmedByWave,
          requestedByWave,
        });
        if (error) return error;

        // Someone on the organisation's block list (#571) can't be put back.
        const blocked = await findOrganiserBlock(
          session.sub,
          {
            userIds: reinstated.map((r) => byId.get(r.id)?.userId),
            emails: reinstated.map((r) => byId.get(r.id)?.athleteEmail),
          },
          tx,
        );
        if (blocked) {
          return `${blocked.email} is on your organisation's blocked list.`;
        }
      }

      // Clear the bibs first so a swap inside one batch never trips the
      // unique index part-way through.
      for (const teamId of teamBibUpdates.keys()) {
        await tx.team.update({ where: { id: teamId }, data: { bibNumber: null } });
      }
      for (const [teamId, bib] of teamBibUpdates) {
        if (bib) await tx.team.update({ where: { id: teamId }, data: { bibNumber: bib } });
      }

      // The status each decision was made against must still hold, or a
      // refund that landed meanwhile could be overwritten. A row can appear
      // twice (its own change, and a teammate's start wave), so track the
      // status this batch has already written.
      const statusNow = new Map(existing.map((r) => [r.id, r.status]));
      for (const u of updates) {
        const expected = statusNow.get(u.id)!;
        const result = await tx.registration.updateMany({
          where: { id: u.id, eventId: id, status: expected },
          data: u.data as Prisma.RegistrationUncheckedUpdateManyInput,
        });
        if (result.count !== 1) throw new StaleRegistrationError();
        if (u.data.status) statusNow.set(u.id, u.data.status as RegistrationStatus);
      }
      return null;
    }).catch((err: unknown) => {
      if (err instanceof StaleRegistrationError) return STALE;
      throw err;
    });

    if (capacityError === STALE) {
      return NextResponse.json(
        { error: "An entry changed while you were editing. Refresh and try again." },
        { status: 409 },
      );
    }
    if (capacityError) {
      return NextResponse.json({ error: `Can't reinstate: ${capacityError}` }, { status: 409 });
    }
  }

  return NextResponse.json({ updated: updates.length + teamBibUpdates.size, unmatched });
}

const STALE = "__stale__";
class StaleRegistrationError extends Error {}
