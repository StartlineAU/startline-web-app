import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { idParams } from "@/lib/schemas";
import { assignSequentialBibs, type BibCandidate } from "@/lib/bib-assignment";
import { RACE_FEATURES_SELECT, organiserSeesBibs, organiserSeesWaves } from "@/lib/race-features";

const bodySchema = z.object({
  start: z.number().int().min(1).max(999_999),
  /** Number athletes with no start wave too, after the last wave. */
  includeUnassigned: z.boolean().optional().default(false),
  /** Work out the range without writing anything, for the preview. */
  dryRun: z.boolean().optional().default(false),
});

class BibsOff extends Error {}

// POST — give every confirmed athlete without a bib the next free number (#566).
// Numbering runs wave by wave in board order, then by name, so a wave's bibs are
// consecutive. Existing bibs are never changed, and taken numbers are skipped.
//
// The read and the writes share one transaction that first locks the event row,
// so two organisers (or a stale tab) running this at once queue up instead of
// both handing out the same numbers. A single-athlete edit does not take the
// lock, so @@unique([eventId, bibNumber]) is the backstop: a clash rolls the
// whole run back and answers 409.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Start number must be a whole number from 1." }, { status: 400 });
  }
  const { start, includeUnassigned, dryRun } = parsedBody.data;

  // The preview is read-only; only a real run counts against the write budget.
  if (!dryRun) {
    const limited = await rateLimit(req, {
      prefix: "bulk-assign-bibs",
      limit: 30,
      windowSeconds: 3600,
      identifier: session.sub,
    });
    if (limited) return limited;
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, organiserId: true },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "events" WHERE id = ${id} FOR UPDATE`;

      const modes = await tx.event.findUniqueOrThrow({ where: { id }, select: RACE_FEATURES_SELECT });
      if (!organiserSeesBibs(modes)) throw new BibsOff();
      const wavesOn = organiserSeesWaves(modes);

      const [registrations, teams, waves] = await Promise.all([
        tx.registration.findMany({
          where: { eventId: id },
          select: {
            id: true, athleteName: true, status: true, bibNumber: true,
            startWaveId: true, startWaveLabel: true, teamId: true,
          },
        }),
        tx.team.findMany({ where: { eventId: id }, select: { id: true, name: true, bibNumber: true } }),
        tx.startWave.findMany({ where: { eventId: id }, select: { id: true, sortOrder: true } }),
      ]);
      const waveSort = new Map(waves.map((w) => [w.id, w.sortOrder]));
      const sortOf = (startWaveId: string | null) =>
        wavesOn && startWaveId ? waveSort.get(startWaveId) ?? null : null;

      // Every bib on the event is taken, solo and team alike (they share one
      // numbering), refunded and cancelled entries included: a number printed
      // for someone who later dropped out is not handed out again.
      const taken = new Set(
        [...registrations.map((r) => r.bibNumber), ...teams.map((t) => t.bibNumber)]
          .map((b) => b?.trim())
          .filter((b): b is string => !!b),
      );

      // A team takes one bib, so it is one candidate, named and waved like the
      // team. It needs at least one confirmed member to be numbered.
      const TEAM = "team:";
      const confirmedByTeam = new Map<string, (typeof registrations)[number]>();
      for (const r of registrations) {
        if (r.teamId && r.status === "CONFIRMED" && !confirmedByTeam.has(r.teamId)) confirmedByTeam.set(r.teamId, r);
      }
      const solo: BibCandidate[] = registrations
        .filter((r) => r.status === "CONFIRMED" && !r.teamId)
        .map((r) => ({
          id: r.id,
          name: r.athleteName,
          bibNumber: r.bibNumber,
          waveLabel: wavesOn ? r.startWaveLabel : null,
          waveSort: sortOf(r.startWaveId),
        }));
      const teamCandidates: BibCandidate[] = teams
        .filter((t) => confirmedByTeam.has(t.id))
        .map((t) => {
          const member = confirmedByTeam.get(t.id)!;
          return {
            id: `${TEAM}${t.id}`,
            name: t.name,
            bibNumber: t.bibNumber,
            waveLabel: wavesOn ? member.startWaveLabel : null,
            waveSort: sortOf(member.startWaveId),
          };
        });

      const all = [...solo, ...teamCandidates];
      // With waves on, athletes still waiting for a wave are skipped unless the
      // organiser asks for them. With waves off there are no waves to wait for.
      const candidates = all.filter((c) => !wavesOn || includeUnassigned || c.waveSort != null);

      const assignments = assignSequentialBibs({ candidates, start, onlyWithoutBib: true, taken });

      if (!dryRun) {
        for (const a of assignments) {
          if (a.registrationId.startsWith(TEAM)) {
            await tx.team.update({ where: { id: a.registrationId.slice(TEAM.length) }, data: { bibNumber: a.bibNumber } });
          } else {
            await tx.registration.update({ where: { id: a.registrationId }, data: { bibNumber: a.bibNumber } });
          }
        }
      }

      const skippedNoWave = wavesOn && !includeUnassigned
        ? all.filter((c) => !c.bibNumber?.trim() && c.waveSort == null).length
        : 0;

      return {
        count: assignments.length,
        first: assignments[0]?.bibNumber ?? null,
        last: assignments.at(-1)?.bibNumber ?? null,
        skippedNoWave,
      };
    }, { timeout: 30_000 });

    return NextResponse.json({ ...result, dryRun });
  } catch (err) {
    if (err instanceof BibsOff) {
      return NextResponse.json({ error: "Bib numbers are turned off for this event." }, { status: 409 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2034")) {
      return NextResponse.json(
        { error: "Someone else changed bibs on this event at the same time. Nothing was saved. Refresh and try again." },
        { status: 409 },
      );
    }
    throw err;
  }
}
