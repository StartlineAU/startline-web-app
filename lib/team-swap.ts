import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { holdsTeamPlace, TEAM_HELD_STATUSES } from "@/lib/team-entries";
import { createEmptyParticipant, compactParticipant, type RegistrationFormData } from "@/lib/registration-form";
import { ensureParticipantUsers, entryIdentityKey } from "@/lib/registration-confirm";
import { findHeldEntryFor, memberDetailsData, memberDetailsError } from "@/lib/team-members";
import { isBlockedByOrganiser } from "@/lib/organiser-blocks";

/**
 * Handing a team place to someone else. The entry, its payment and its
 * race-day state stay put; only the person holding it changes.
 *
 * Used by the organiser's team edit (a straight swap) and by Remove from event
 * when the organiser replaces the member they are removing (#571).
 */

/** The new holder's details, as the organiser enters them. */
export const replacementSchema = z.object({
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  email: z.string().max(255),
  dateOfBirth: z.string().max(20),
  gender: z.string().max(50).optional(),
  mobile: z.string().max(50),
  emergencyContactName: z.string().max(200),
  emergencyContactPhone: z.string().max(50),
});
export type ReplacementDetails = z.infer<typeof replacementSchema>;

export const PLACE_GONE = "This place was cancelled or refunded, so there is nothing to hand over.";
export const BLOCKED_SWAP_MESSAGE =
  "That person is on your organisation's blocked list. Remove them from Settings → Blocked athletes first.";

export class SwapError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "SwapError";
  }
}

/** The holder's details a swap replaces, kept in the change log. */
export const holderSelect = {
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
  detailsPending: true,
  waveLabel: true,
  amountCents: true,
  platformFeeCents: true,
} as const;

export type Holder = Prisma.RegistrationGetPayload<{ select: typeof holderSelect }>;

export interface SwapTarget {
  eventId: string;
  teamId: string;
  registrationId: string;
  organiserId: string;
}

/**
 * Check a swap before anything is written: the place is still held, the new
 * person passes the checks checkout applies, is not already entered, is not
 * the current holder and is not blocked. Throws SwapError; returns the new
 * holder's details ready to write.
 */
export async function prepareSwap(
  target: SwapTarget,
  details: ReplacementDetails,
  minAge: number | null | undefined,
): Promise<RegistrationFormData> {
  const entry = await prisma.registration.findFirst({
    where: { id: target.registrationId, eventId: target.eventId, teamId: target.teamId },
    select: holderSelect,
  });
  if (!entry) throw new SwapError("That person is not on this team.", 404);
  if (!holdsTeamPlace(entry.status)) throw new SwapError(PLACE_GONE, 409);

  // The same checks checkout applies to a new member, minus the waiver and
  // finish estimate the organiser is not asked for.
  const incoming: RegistrationFormData = {
    ...createEmptyParticipant(),
    ...details,
    gender: details.gender ?? "",
    waiverAccepted: true,
  };
  const firstError = memberDetailsError(incoming, minAge);
  if (firstError) throw new SwapError(firstError, 400);

  const incomingKey = entryIdentityKey(incoming.email, incoming.firstName, incoming.lastName, incoming.dateOfBirth);
  const holderKey = entryIdentityKey(entry.athleteEmail, entry.firstName ?? "", entry.lastName ?? "", entry.dateOfBirth ?? "");
  if (incomingKey === holderKey) throw new SwapError("That is already who holds this place.", 400);

  // Checkout refuses a second entry for the same person; so does a swap.
  const clash = await findHeldEntryFor(target.eventId, entry.id, incoming);
  if (clash) {
    throw new SwapError(
      `${clash.athleteName} already holds an entry for this event${clash.teamName ? ` (team ${clash.teamName})` : ""}.`,
      409,
    );
  }
  // A swap can't hand a place to someone on the organisation's block list.
  if (await isBlockedByOrganiser(target.organiserId, { emails: [incoming.email] })) {
    throw new SwapError(BLOCKED_SWAP_MESSAGE, 409);
  }
  return incoming;
}

/**
 * The new member gets an account like any guest entrant, so the entry shows
 * on their Activity. Run before the transaction: it calls Cognito.
 */
export function provisionReplacement(incoming: RegistrationFormData): Promise<Record<string, string>> {
  return ensureParticipantUsers([
    { participant: compactParticipant(incoming), waveLabel: null, priceCents: 0, platformFeeCents: 0 },
  ]);
}

export interface AppliedSwap {
  /** Who held the place before. */
  previous: Holder;
  email: string;
  athleteName: string;
  waveLabel: string | null;
  amountCents: number;
  platformFeeCents: number;
}

/**
 * Write the swap. The caller has taken the event lock (lockEventEntries) in
 * this transaction. Everything is re-checked under it, because the place may
 * have been refunded or the person entered meanwhile.
 */
export async function applySwap(
  tx: Prisma.TransactionClient,
  target: SwapTarget,
  incoming: RegistrationFormData,
  userIdByEmail: Record<string, string>,
  actorEmail: string | null,
): Promise<AppliedSwap> {
  const entry = await tx.registration.findFirst({
    where: {
      id: target.registrationId,
      eventId: target.eventId,
      teamId: target.teamId,
      status: { in: TEAM_HELD_STATUSES },
    },
    select: holderSelect,
  });
  if (!entry) throw new SwapError(PLACE_GONE, 409);
  if (await findHeldEntryFor(target.eventId, entry.id, incoming, tx)) {
    throw new SwapError("That person already holds an entry for this event.", 409);
  }
  if (await isBlockedByOrganiser(target.organiserId, { emails: [incoming.email] }, tx)) {
    throw new SwapError(BLOCKED_SWAP_MESSAGE, 409);
  }

  const after = memberDetailsData(incoming);
  const email = after.athleteEmail;
  await tx.registration.update({
    where: { id: entry.id },
    data: {
      ...after,
      // A place bought "details later" is named now.
      detailsPending: false,
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
      teamId: target.teamId,
      registrationId: entry.id,
      // Naming a place left for later is not a swap: nobody was in it.
      kind: entry.detailsPending ? "DETAILS_ADDED" : "SWAP",
      before: before as Prisma.InputJsonValue,
      after: after as Prisma.InputJsonValue,
      changedByEmail: actorEmail,
      organiserId: target.organiserId,
    },
  });
  return {
    previous: entry,
    email,
    athleteName: after.athleteName,
    waveLabel: entry.waveLabel,
    amountCents: entry.amountCents,
    platformFeeCents: entry.platformFeeCents,
  };
}
