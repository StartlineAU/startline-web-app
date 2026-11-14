import { NextRequest, NextResponse } from "next/server";
import { entryBib, holdsTeamPlace } from "@/lib/team-entries";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { wavesWithCounts } from "@/lib/start-waves";
import type { RegistrationStatus, Prisma } from "@prisma/client";
import { idParams } from "@/lib/schemas";
import { z } from "zod";

const STATUSES = new Set(["CONFIRMED", "REFUND_REQUESTED", "REFUNDED", "CANCELLED"]);

const registrationPatchRowSchema = z.object({
  registrationId: z.string().min(1).max(255),
  startWaveId: z.string().max(255).nullable().optional(),
  startWaveLabel: z.string().max(255).nullable().optional(),
  bibNumber: z.string().max(50).nullable().optional(),
  status: z.enum(["CONFIRMED", "REFUND_REQUESTED", "REFUNDED", "CANCELLED"]).optional(),
  estimatedFinishMinutes: z.number().int().min(0).nullable().optional(),
});

const registrationPatchSchema = z.object({
  registrations: z.array(registrationPatchRowSchema).min(1),
});

async function assertOwnedEvent(eventId: string, organiserId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organiserId: true, waves: true, title: true },
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
    select: { id: true, bibNumber: true, teamId: true, status: true },
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
      if (!STATUSES.has(row.status)) {
        return NextResponse.json({ error: `Invalid status "${row.status}".` }, { status: 400 });
      }
      data.status = row.status as RegistrationStatus;
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
    await prisma.$transaction([
      // Clear the bibs first so a swap inside one batch never trips the
      // unique index part-way through.
      ...[...teamBibUpdates.keys()].map((teamId) =>
        prisma.team.update({ where: { id: teamId }, data: { bibNumber: null } })),
      ...[...teamBibUpdates].filter(([, bib]) => bib).map(([teamId, bib]) =>
        prisma.team.update({ where: { id: teamId }, data: { bibNumber: bib } })),
      ...updates.map((u) => prisma.registration.update({ where: { id: u.id }, data: u.data })),
    ]);
  }

  return NextResponse.json({ updated: updates.length + teamBibUpdates.size, unmatched });
}
