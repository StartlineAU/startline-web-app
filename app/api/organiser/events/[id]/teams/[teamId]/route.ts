import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { MAX_TEAM_NAME_LENGTH, normaliseTeamName } from "@/lib/team-tickets";
import { findTakenTeamNames, holdsTeamPlace, TEAM_HELD_STATUSES } from "@/lib/team-entries";
import {
  getRegistrationFormErrors,
  createEmptyParticipant,
  compactParticipant,
  type RegistrationFormData,
} from "@/lib/registration-form";
import {
  ensureParticipantUsers,
  entryIdentityKey,
  sendEntryConfirmation,
} from "@/lib/registration-confirm";

const paramsSchema = z.object({
  id: z.string().min(1).max(255),
  teamId: z.string().min(1).max(255),
});

/**
 * A swap replaces who holds a team place. The entry, its payment and its
 * race-day state stay put; only the person's details change.
 */
const memberSchema = z.object({
  registrationId: z.string().min(1).max(255),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  email: z.string().max(255),
  dateOfBirth: z.string().max(20),
  gender: z.string().max(50).optional(),
  mobile: z.string().max(50),
  emergencyContactName: z.string().max(200),
  emergencyContactPhone: z.string().max(50),
});

const bodySchema = z
  .object({
    name: z.string().max(MAX_TEAM_NAME_LENGTH * 2).optional(),
    member: memberSchema.optional(),
  })
  .refine((b) => b.name !== undefined || b.member !== undefined, { message: "Nothing to change." });

/** The holder's details a swap replaces, kept in the change log. */
const holderSelect = {
  id: true,
  status: true,
  athleteName: true,
  athleteEmail: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  mobile: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  userId: true,
  waveLabel: true,
  amountCents: true,
  platformFeeCents: true,
} as const;

const PLACE_GONE = "This place was cancelled or refunded, so there is nothing to hand over.";

class Conflict extends Error {}

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
          id: true, organiserId: true, title: true, feeStructure: true, waves: true, cap: true,
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

  // ── Swap: validate ──
  let incoming: RegistrationFormData | null = null;
  if (member) {
    const entry = await prisma.registration.findFirst({
      where: { id: member.registrationId, eventId: id, teamId },
      select: holderSelect,
    });
    if (!entry) return NextResponse.json({ error: "That person is not on this team." }, { status: 404 });
    if (!holdsTeamPlace(entry.status)) return NextResponse.json({ error: PLACE_GONE }, { status: 409 });

    // The same checks checkout applies to a new member, minus the waiver and
    // finish estimate the organiser is not asked for.
    incoming = {
      ...createEmptyParticipant(),
      ...member,
      gender: member.gender ?? "",
      waiverAccepted: true,
    };
    const errors = getRegistrationFormErrors(incoming, { includeEmergencyContact: true, includeWaiver: false });
    const firstError = Object.values(errors)[0];
    if (firstError) return NextResponse.json({ error: firstError }, { status: 400 });

    const incomingKey = entryIdentityKey(incoming.email, incoming.firstName, incoming.lastName, incoming.dateOfBirth);
    const holderKey = entryIdentityKey(entry.athleteEmail, entry.firstName ?? "", entry.lastName ?? "", entry.dateOfBirth ?? "");
    if (incomingKey === holderKey) {
      return NextResponse.json({ error: "That is already who holds this place." }, { status: 400 });
    }
    // Checkout refuses a second entry for the same person; so does a swap.
    const clash = await findHeldEntryFor(id, entry.id, incoming);
    if (clash) {
      return NextResponse.json(
        { error: `${clash.athleteName} already holds an entry for this event${clash.teamName ? ` (team ${clash.teamName})` : ""}.` },
        { status: 409 },
      );
    }
  }

  if (!nextName && !incoming) return NextResponse.json({ ok: true });

  // The new member gets an account like any guest entrant, so the entry
  // shows on their Activity. Done before the transaction: it calls Cognito.
  const userIdByEmail = incoming
    ? await ensureParticipantUsers([
        { participant: compactParticipant(incoming), waveLabel: null, priceCents: 0, platformFeeCents: 0 },
      ])
    : {};

  let swapped: { email: string; waveLabel: string | null; amountCents: number; platformFeeCents: number } | null;
  try {
    swapped = await prisma.$transaction(async (tx) => {
      // The confirm transaction takes the same lock, so a checkout cannot take
      // this name, or enter this person, between the checks and the writes.
      await tx.$queryRaw`SELECT id FROM "events" WHERE id = ${id} FOR UPDATE`;

      if (nextName) {
        if (nextName.toLowerCase() !== team.name.toLowerCase()) {
          const taken = await findTakenTeamNames(id, [nextName], tx, teamId);
          if (taken) throw new Conflict(`A team called "${taken}" is already entered in this event.`);
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

      if (!member || !incoming) return null;

      // Re-read under the lock: the place may have been refunded meanwhile.
      const entry = await tx.registration.findFirst({
        where: { id: member.registrationId, eventId: id, teamId, status: { in: TEAM_HELD_STATUSES } },
        select: holderSelect,
      });
      if (!entry) throw new Conflict(PLACE_GONE);
      if (await findHeldEntryFor(id, entry.id, incoming, tx)) {
        throw new Conflict("That person already holds an entry for this event.");
      }

      const email = incoming.email.trim().toLowerCase();
      const firstName = incoming.firstName.trim();
      const lastName = incoming.lastName.trim();
      const after = {
        athleteName: `${firstName} ${lastName}`.trim(),
        athleteEmail: email,
        firstName,
        lastName,
        dateOfBirth: incoming.dateOfBirth,
        gender: incoming.gender.trim() || null,
        mobile: incoming.mobile.trim(),
        emergencyContactName: incoming.emergencyContactName.trim(),
        emergencyContactPhone: incoming.emergencyContactPhone.trim(),
      };
      await tx.registration.update({
        where: { id: entry.id },
        data: {
          ...after,
          // The entry now belongs to the new member's account.
          userId: userIdByEmail[email] ?? null,
          // The previous holder's details and estimate no longer apply.
          medicalNotes: null,
          estimatedFinishMinutes: null,
        },
      });
      const before = {
        athleteName: entry.athleteName,
        athleteEmail: entry.athleteEmail,
        firstName: entry.firstName,
        lastName: entry.lastName,
        dateOfBirth: entry.dateOfBirth,
        gender: entry.gender,
        mobile: entry.mobile,
        emergencyContactName: entry.emergencyContactName,
        emergencyContactPhone: entry.emergencyContactPhone,
        userId: entry.userId,
      };
      await tx.teamMemberChange.create({
        data: {
          teamId,
          registrationId: entry.id,
          kind: "SWAP",
          before: before as Prisma.InputJsonValue,
          after: after as Prisma.InputJsonValue,
          changedByEmail: auth.actorEmail ?? null,
          organiserId: auth.session.sub,
        },
      });
      return {
        email,
        waveLabel: entry.waveLabel,
        amountCents: entry.amountCents,
        platformFeeCents: entry.platformFeeCents,
      };
    });
  } catch (err) {
    if (err instanceof Conflict) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }

  // The new member is told they hold the place, as they would be at checkout.
  if (swapped) {
    await sendEntryConfirmation(team.event, {
      email: swapped.email,
      waveLabel: swapped.waveLabel,
      priceCents: swapped.amountCents,
      platformFeeCents: swapped.platformFeeCents,
      team: { name: nextName ?? team.name, size: team.size },
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Another entry in this event, still holding a place, for the same person
 * (email, name and date of birth, matched as checkout matches them).
 */
async function findHeldEntryFor(
  eventId: string,
  excludeId: string,
  person: RegistrationFormData,
  db: Pick<typeof prisma, "registration"> = prisma,
): Promise<{ athleteName: string; teamName: string | null } | null> {
  const rows = await db.registration.findMany({
    where: {
      eventId,
      id: { not: excludeId },
      status: { in: TEAM_HELD_STATUSES },
      athleteEmail: { equals: person.email.trim(), mode: "insensitive" },
    },
    select: {
      athleteName: true, athleteEmail: true, firstName: true, lastName: true, dateOfBirth: true,
      team: { select: { name: true } },
    },
  });
  const key = entryIdentityKey(person.email, person.firstName, person.lastName, person.dateOfBirth);
  const match = rows.find(
    (r) => entryIdentityKey(r.athleteEmail, r.firstName ?? "", r.lastName ?? "", r.dateOfBirth ?? "") === key,
  );
  return match ? { athleteName: match.athleteName, teamName: match.team?.name ?? null } : null;
}
