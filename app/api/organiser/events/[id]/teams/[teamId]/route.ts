import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { lockEventEntries } from "@/lib/event-entry-lock";
import { MAX_TEAM_NAME_LENGTH, normaliseTeamName } from "@/lib/team-tickets";
import { findTakenTeamNames } from "@/lib/team-entries";
import type { RegistrationFormData } from "@/lib/registration-form";
import { sendEntryConfirmation } from "@/lib/registration-confirm";
import {
  applySwap,
  prepareSwap,
  provisionReplacement,
  replacementSchema,
  SwapError,
  type AppliedSwap,
} from "@/lib/team-swap";

const paramsSchema = z.object({
  id: z.string().min(1).max(255),
  teamId: z.string().min(1).max(255),
});

/**
 * A swap replaces who holds a team place. The entry, its payment and its
 * race-day state stay put; only the person's details change (lib/team-swap.ts).
 */
const memberSchema = replacementSchema.extend({
  registrationId: z.string().min(1).max(255),
});

const bodySchema = z
  .object({
    name: z.string().max(MAX_TEAM_NAME_LENGTH * 2).optional(),
    member: memberSchema.optional(),
  })
  .refine((b) => b.name !== undefined || b.member !== undefined, { message: "Nothing to change." });

/**
 * PATCH: rename a team, swap one of its members for someone else, or both.
 * Everything is checked before anything is written, and the writes land in
 * one transaction, so a refused swap never leaves a half-applied rename.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id, teamId } = parsedParams.data;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      eventId: true,
      name: true,
      size: true,
      event: {
        select: {
          id: true, organiserId: true, title: true, feeStructure: true, waves: true, cap: true, minAge: true,
          eventDate: true, startTime: true, venue: true, city: true, state: true,
          startsAtUtc: true, endsAtUtc: true,
        },
      },
    },
  });
  if (!team || team.eventId !== id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (team.event.organiserId !== auth.session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { name, member } = parsedBody.data;

  // ── Rename: validate ──
  let nextName: string | null = null;
  if (name !== undefined) {
    const next = normaliseTeamName(name);
    if (!next) return NextResponse.json({ error: "Give the team a name." }, { status: 400 });
    if (next.length > MAX_TEAM_NAME_LENGTH) {
      return NextResponse.json({ error: `Team names can be at most ${MAX_TEAM_NAME_LENGTH} characters.` }, { status: 400 });
    }
    if (next !== team.name) nextName = next;
  }

  const target = member
    ? { eventId: id, teamId, registrationId: member.registrationId, organiserId: auth.session.sub }
    : null;

  try {
    // ── Swap: validate ──
    let incoming: RegistrationFormData | null = null;
    if (member && target) {
      const { registrationId: _ignored, ...details } = member;
      incoming = await prepareSwap(target, details, team.event.minAge);
    }

    if (!nextName && !incoming) return NextResponse.json({ ok: true });

    const userIdByEmail = incoming ? await provisionReplacement(incoming) : {};

    const swapped: AppliedSwap | null = await prisma.$transaction(async (tx) => {
      // The confirm transaction takes the same lock, so a checkout cannot take
      // this name, or enter this person, between the checks and the writes.
      await lockEventEntries(tx, id);

      if (nextName) {
        if (nextName.toLowerCase() !== team.name.toLowerCase()) {
          const taken = await findTakenTeamNames(id, [nextName], tx, teamId);
          if (taken) throw new SwapError(`A team called "${taken}" is already entered in this event.`, 409);
        }
        await tx.team.update({ where: { id: teamId }, data: { name: nextName } });
        await tx.teamMemberChange.create({
          data: {
            teamId,
            kind: "RENAME",
            before: { name: team.name },
            after: { name: nextName },
            changedByEmail: auth.actorEmail ?? null,
            organiserId: auth.session.sub,
          },
        });
      }

      if (!target || !incoming) return null;
      return applySwap(tx, target, incoming, userIdByEmail, auth.actorEmail ?? null);
    });

    // The new member is told they hold the place, as they would be at checkout.
    if (swapped) {
      await sendEntryConfirmation(team.event, {
        registrationId: swapped.registrationId,
        email: swapped.email,
        waveLabel: swapped.waveLabel,
        priceCents: swapped.amountCents,
        platformFeeCents: swapped.platformFeeCents,
        team: { name: nextName ?? team.name, size: team.size },
      });
    }
  } catch (err) {
    if (err instanceof SwapError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  return NextResponse.json({ ok: true });
}
