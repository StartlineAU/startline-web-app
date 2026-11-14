import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { TEAM_HELD_STATUSES } from "@/lib/team-tickets";
import {
  compactParticipant,
  createEmptyParticipant,
  type RegistrationFormData,
} from "@/lib/registration-form";
import { ensureParticipantUsers, sendEntryConfirmation } from "@/lib/registration-confirm";
import {
  findHeldEntryFor,
  memberDetailsData,
  memberDetailsError,
  memberExtrasData,
} from "@/lib/team-members";

const bodySchema = z.object({
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  email: z.string().max(255),
  dateOfBirth: z.string().max(20),
  gender: z.string().max(50).optional(),
  mobile: z.string().max(50),
  emergencyContactName: z.string().max(200),
  emergencyContactPhone: z.string().max(50),
  medicalNotes: z.string().max(2000).optional(),
  estimatedFinish: z.string().max(20).optional(),
});

/** Events that still take changes to who is racing. */
const OPEN_STATUSES = new Set(["APPROVED", "IN_PROGRESS"]);

const PLACE_GONE = "This team place was cancelled or refunded, so there is no one to add.";

class Conflict extends Error {}

/**
 * POST: add the details of a team member the buyer left for later (#541).
 *
 * The place is already paid for and held. Only whoever holds it (the buyer,
 * by account or email) can name its member, and only once: after that it is
 * an ordinary entry the organiser can swap if it has to change. The member
 * gets their own confirmation email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const limited = await rateLimit(req, {
    prefix: "team-member-details",
    identifier: session.sub,
    limit: 30,
    windowSeconds: 600,
  });
  if (limited) return limited;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  const { id } = parsedParams.data;

  const registration = await prisma.registration.findUnique({
    where: { id },
    select: {
      id: true, userId: true, athleteEmail: true, athleteName: true, status: true,
      detailsPending: true, eventId: true, waveLabel: true, amountCents: true, platformFeeCents: true,
      team: { select: { id: true, name: true, size: true } },
      event: {
        select: {
          id: true, organiserId: true, status: true, minAge: true, title: true, feeStructure: true,
          waves: true, cap: true, eventDate: true, startTime: true, venue: true, city: true, state: true,
          startsAtUtc: true, endsAtUtc: true,
        },
      },
    },
  });

  // Scoped to the caller's own places, by account or by email.
  const isOwner =
    !!registration &&
    (registration.userId === session.sub ||
      registration.athleteEmail.toLowerCase() === session.email.toLowerCase());
  if (!registration || !isOwner || !registration.team) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  if (!registration.detailsPending) {
    return NextResponse.json({ error: "This team member's details have already been added." }, { status: 409 });
  }
  if (!(TEAM_HELD_STATUSES as string[]).includes(registration.status)) {
    return NextResponse.json({ error: PLACE_GONE }, { status: 409 });
  }
  if (!OPEN_STATUSES.has(registration.event.status)) {
    return NextResponse.json({ error: "This event has finished, so its entries can no longer change." }, { status: 409 });
  }

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const person: RegistrationFormData = {
    ...createEmptyParticipant(),
    ...parsedBody.data,
    gender: parsedBody.data.gender ?? "",
    medicalNotes: parsedBody.data.medicalNotes ?? "",
    estimatedFinish: parsedBody.data.estimatedFinish ?? "",
    waiverAccepted: true,
  };
  const detailsError = memberDetailsError(person, registration.event.minAge);
  if (detailsError) return NextResponse.json({ error: detailsError }, { status: 400 });

  // Checkout refuses a second entry for the same person; so does this.
  const clash = await findHeldEntryFor(registration.eventId, registration.id, person);
  if (clash) {
    return NextResponse.json(
      { error: `${clash.athleteName} already holds an entry for this event${clash.teamName ? ` (team ${clash.teamName})` : ""}.` },
      { status: 409 },
    );
  }

  // The member gets an account like any guest entrant, so the entry shows on
  // their own Activity. Done before the transaction: it calls Cognito. The
  // place stays on the buyer's account too, as a place bought for someone at
  // checkout does.
  await ensureParticipantUsers([
    { participant: compactParticipant(person), waveLabel: null, priceCents: 0, platformFeeCents: 0 },
  ]);

  const details = memberDetailsData(person);
  try {
    await prisma.$transaction(async (tx) => {
      // The confirm transaction takes the same lock, so a checkout cannot
      // enter this person between the check and the write.
      await tx.$queryRaw`SELECT id FROM "events" WHERE id = ${registration.eventId} FOR UPDATE`;

      const updated = await tx.registration.updateMany({
        where: { id: registration.id, detailsPending: true, status: { in: TEAM_HELD_STATUSES } },
        data: { ...details, ...memberExtrasData(person), detailsPending: false },
      });
      // Someone else named this place, or it was refunded, in the meantime.
      if (updated.count === 0) throw new Conflict("This team member's details have already been added, or the place was released.");
      if (await findHeldEntryFor(registration.eventId, registration.id, person, tx)) {
        throw new Conflict("That person already holds an entry for this event.");
      }

      await tx.teamMemberChange.create({
        data: {
          teamId: registration.team!.id,
          registrationId: registration.id,
          kind: "DETAILS_ADDED",
          before: { athleteName: registration.athleteName } as Prisma.InputJsonValue,
          after: details as Prisma.InputJsonValue,
          changedByEmail: session.email,
          organiserId: registration.event.organiserId,
        },
      });
    });
  } catch (err) {
    if (err instanceof Conflict) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }

  await sendEntryConfirmation(registration.event, {
    email: details.athleteEmail,
    waveLabel: registration.waveLabel,
    priceCents: registration.amountCents,
    platformFeeCents: registration.platformFeeCents,
    team: { name: registration.team.name, size: registration.team.size },
  });

  return NextResponse.json({ ok: true, athleteName: details.athleteName });
}
