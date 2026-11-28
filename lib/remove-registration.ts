import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { issueEntryRefund, refundEntrySelect, RefundError } from "@/lib/issue-entry-refund";
import { entryPaidCents } from "@/lib/stripe-refunds";
import { TEAM_HELD_STATUSES } from "@/lib/team-tickets";
import { normalizeBlockEmail, upsertOrganiserBlock } from "@/lib/organiser-blocks";
import { sendRemovedFromEventEmail } from "@/lib/email";
import { lockEventEntries } from "@/lib/event-entry-lock";
import { sendEntryConfirmation } from "@/lib/registration-confirm";
import {
  applySwap,
  prepareSwap,
  provisionReplacement,
  SwapError,
  type AppliedSwap,
  type ReplacementDetails,
} from "@/lib/team-swap";
import {
  noteRequired,
  refundOptional,
  REMOVAL_REASON_LABEL,
  type RemovalReasonValue,
} from "@/lib/removal-reasons";

/**
 * An organiser takes one entry out of an event (#571).
 *
 * The entry is kept, as REMOVED, so reporting can tell an organiser removal
 * from an athlete cancelling. Its bib and start wave are released, a paid entry
 * is refunded in full through Stripe (unless the reason is a code of conduct
 * breach and the organiser chose not to), the athlete is told, and the why and
 * who are written to RegistrationRemoval, which is never edited.
 *
 * Removal is allowed at any point, including after check-in or after the
 * event. A team entry loses only this member; the rest of the team stays.
 *
 * A team member can instead be removed and replaced: their place, with its
 * payment, bib and wave, passes to someone the organiser names, exactly as a
 * team swap does (lib/team-swap.ts). The entry stays CONFIRMED for the new
 * holder, nothing is refunded because the place is still in use, and the
 * removed person is told and logged like any other removal.
 */

export class RemovalError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "RemovalError";
  }
}

export interface RemoveRegistrationInput {
  registrationId: string;
  eventId: string;
  organiserId: string;
  /** The signed-in person doing it, for the log. */
  actorEmail: string;
  reason: RemovalReasonValue;
  note?: string | null;
  /** Pass the note on to the athlete. */
  shareNote?: boolean;
  /** Only read for a paid entry. NONE is refused unless the reason allows it. */
  refund: "FULL" | "NONE";
  block?: boolean;
  /** Team members only: hand the place to this person instead of emptying it. */
  replacement?: ReplacementDetails;
}

export interface RemoveRegistrationResult {
  refund: "FULL" | "NONE" | "NOT_PAID" | "REPLACED";
  refundCents: number;
  blocked: boolean;
  /** Set when a team is left with fewer members than its ticket is for. */
  warning: string | null;
  /** Who now holds the place, when it was handed over. */
  replacedBy: string | null;
}

const RELEASE = { bibNumber: null, startWaveId: null, startWaveLabel: null } satisfies Prisma.RegistrationUncheckedUpdateManyInput;

const removalSelect = {
  ...refundEntrySelect,
  athleteEmail: true,
  organiserId: true,
  teamId: true,
  detailsPending: true,
  team: { select: { id: true, name: true, size: true, captainRegistrationId: true } },
  event: {
    select: {
      id: true, title: true, feeStructure: true, waves: true, cap: true, minAge: true,
      eventDate: true, startTime: true, venue: true, city: true, state: true,
      startsAtUtc: true, endsAtUtc: true, refundTiers: true,
      organiser: { select: { orgName: true } },
    },
  },
} as const;

export async function removeRegistration(input: RemoveRegistrationInput): Promise<RemoveRegistrationResult> {
  const note = input.note?.trim() || null;
  if (noteRequired(input.reason) && !note) {
    throw new RemovalError("Say why in the note when the reason is Other.", 400);
  }

  const entry = await prisma.registration.findFirst({
    where: { id: input.registrationId, eventId: input.eventId, organiserId: input.organiserId },
    select: removalSelect,
  });
  if (!entry) throw new RemovalError("Registration not found.", 404);
  if (!(TEAM_HELD_STATUSES as string[]).includes(entry.status)) {
    throw new RemovalError("This entry no longer holds a place, so there is nothing to remove.", 409);
  }

  if (input.replacement) return removeAndReplace(input, entry, note);

  // Money only comes back through Stripe when Startline took it. An entry with
  // a price but no payment was recorded outside checkout.
  const paidCents = entryPaidCents(entry);
  const paid = Boolean(entry.stripePaymentIntentId) && paidCents > 0;
  if (paid && input.refund === "NONE" && !refundOptional(input.reason)) {
    throw new RemovalError(
      "A paid entry is refunded in full when it is removed. Only a code of conduct removal can keep the entry fee.",
      400,
    );
  }
  const refund: RemoveRegistrationResult["refund"] = !paid ? "NOT_PAID" : input.refund;

  let refundCents = 0;
  let stripeRefundId: string | null = null;

  if (refund === "FULL") {
    // Refund first: a Stripe failure leaves the entry exactly as it was, so
    // the organiser can try again. The status change and the release happen
    // in the same write that records the refund.
    try {
      const result = await issueEntryRefund(
        { ...entry, refundAmountCents: paidCents },
        { finalStatus: "REMOVED", extraData: RELEASE, notify: false },
      );
      refundCents = result.refundCents;
      stripeRefundId = result.refundId;
    } catch (err) {
      if (err instanceof RefundError) throw new RemovalError(err.message, err.status);
      throw err;
    }
  }

  const blocked = Boolean(input.block);
  await prisma.$transaction(async (tx) => {
    if (refund !== "FULL") {
      const moved = await tx.registration.updateMany({
        where: { id: entry.id, status: { in: TEAM_HELD_STATUSES } },
        data: { ...RELEASE, status: "REMOVED" },
      });
      if (moved.count !== 1) {
        throw new RemovalError("This entry changed a moment ago. Refresh and try again.", 409);
      }
    }

    await tx.registrationRemoval.create({
      data: {
        registrationId: entry.id,
        organiserId: input.organiserId,
        eventId: input.eventId,
        athleteName: entry.athleteName,
        athleteEmail: entry.athleteEmail,
        removedByEmail: input.actorEmail,
        reason: input.reason,
        note,
        noteShared: Boolean(input.shareNote && note),
        refund,
        refundCents,
        stripeRefundId,
        blocked,
      },
    });

    if (entry.team?.captainRegistrationId === entry.id) {
      await tx.team.update({ where: { id: entry.team.id }, data: { captainRegistrationId: null } });
    }

    if (blocked) await blockRemoved(tx, input, entry);
  });

  let warning: string | null = null;
  if (entry.team) {
    const left = await prisma.registration.count({
      where: { teamId: entry.team.id, status: { in: TEAM_HELD_STATUSES } },
    });
    if (left < entry.team.size) {
      warning = `Team ${entry.team.name} now has ${left} of ${entry.team.size} members.`;
    }
  }

  await notifyRemoval(entry, {
    reasonLabel: REMOVAL_REASON_LABEL[input.reason],
    note: input.shareNote ? note : null,
    refundCents,
    noRefund: paid && refund === "NONE",
    blocked,
    replacedBy: null,
  });

  return { refund, refundCents, blocked, warning, replacedBy: null };
}

type RemovedEntry = Prisma.RegistrationGetPayload<{ select: typeof removalSelect }>;

async function blockRemoved(
  tx: Prisma.TransactionClient,
  input: RemoveRegistrationInput,
  entry: RemovedEntry,
): Promise<void> {
  await upsertOrganiserBlock(
    {
      organiserId: input.organiserId,
      email: entry.athleteEmail,
      userId: entry.userId,
      name: entry.athleteName,
      note: `Removed from ${entry.event.title}: ${REMOVAL_REASON_LABEL[input.reason]}`,
      createdByEmail: input.actorEmail,
    },
    tx,
  );
}

/**
 * Remove a team member and give their place to someone else, in one
 * transaction under the event lock, so the place is never empty and never
 * held by two people.
 */
async function removeAndReplace(
  input: RemoveRegistrationInput,
  entry: RemovedEntry,
  note: string | null,
): Promise<RemoveRegistrationResult> {
  const replacement = input.replacement!;
  if (!entry.team || !entry.teamId) {
    throw new RemovalError("Only a team member's place can be handed to someone else.", 400);
  }
  if (entry.detailsPending) {
    throw new RemovalError("Nobody holds this place yet. Add the member's details instead.", 400);
  }
  const team = entry.team;
  const target = {
    eventId: input.eventId,
    teamId: entry.teamId,
    registrationId: entry.id,
    organiserId: input.organiserId,
  };

  const blocked = Boolean(input.block);
  let swapped: AppliedSwap;
  try {
    const incoming = await prepareSwap(target, replacement, entry.event.minAge);
    // A block covers the removed person's email, so a replacement on the same
    // address would hold a place the organiser has just blocked.
    if (blocked && normalizeBlockEmail(incoming.email) === normalizeBlockEmail(entry.athleteEmail)) {
      throw new RemovalError("The replacement uses the email you're blocking. Give them their own email.", 400);
    }
    const userIdByEmail = await provisionReplacement(incoming);

    swapped = await prisma.$transaction(async (tx) => {
      await lockEventEntries(tx, input.eventId);
      const applied = await applySwap(tx, target, incoming, userIdByEmail, input.actorEmail);

      await tx.registrationRemoval.create({
        data: {
          registrationId: entry.id,
          organiserId: input.organiserId,
          eventId: input.eventId,
          // The row now holds the replacement: record who was removed.
          athleteName: applied.previous.athleteName,
          athleteEmail: applied.previous.athleteEmail,
          replacedByName: applied.athleteName,
          replacedByEmail: applied.email,
          removedByEmail: input.actorEmail,
          reason: input.reason,
          note,
          noteShared: Boolean(input.shareNote && note),
          refund: "REPLACED",
          refundCents: 0,
          blocked,
        },
      });

      if (blocked) await blockRemoved(tx, input, entry);
      return applied;
    });
  } catch (err) {
    if (err instanceof SwapError) throw new RemovalError(err.message, err.status);
    throw err;
  }

  // The new member is told they hold the place, as they would be at checkout.
  try {
    await sendEntryConfirmation(entry.event, {
      registrationId: swapped.registrationId,
      email: swapped.email,
      waveLabel: swapped.waveLabel,
      priceCents: swapped.amountCents,
      platformFeeCents: swapped.platformFeeCents,
      team: { name: team.name, size: team.size },
    });
  } catch (err) {
    console.error("Replacement confirmation failed:", entry.id, err);
  }

  await notifyRemoval(entry, {
    reasonLabel: REMOVAL_REASON_LABEL[input.reason],
    note: input.shareNote ? note : null,
    refundCents: 0,
    noRefund: false,
    blocked,
    replacedBy: swapped.athleteName,
  });

  return { refund: "REPLACED", refundCents: 0, blocked, warning: null, replacedBy: swapped.athleteName };
}

// Best-effort, like every other athlete notice: the removal has happened
// whether or not a message gets through.
async function notifyRemoval(
  entry: RemovedEntry,
  details: {
    reasonLabel: string;
    note: string | null;
    refundCents: number;
    noRefund: boolean;
    blocked: boolean;
    /** The new holder's name, when the place was handed over. */
    replacedBy: string | null;
  },
): Promise<void> {
  const organiserName = entry.event.organiser.orgName || "The organiser";
  const refundLine = details.refundCents > 0
    ? ` A refund of $${(details.refundCents / 100).toFixed(2)} is on its way to your original payment method.`
    : "";
  const noteLine = details.note ? ` Note from the organiser: "${details.note}"` : "";
  // A handed-over place is still paid for by the team's booking.
  const placeLine = details.replacedBy && entry.team
    ? ` Your place on team ${entry.team.name} has been given to another member, so no refund is due.`
    : "";

  try {
    const rows: Prisma.UserNotificationCreateManyInput[] = [];
    if (entry.userId) {
      rows.push({
        userId: entry.userId,
        type: "REMOVED_FROM_EVENT",
        title: "Removed from event",
        body: `${organiserName} removed your entry from ${entry.event.title}. Reason: ${details.reasonLabel}.${refundLine}${placeLine}${noteLine}`,
        eventId: entry.event.id,
      });
    }
    // The person who booked a team hears that it lost a member.
    if (entry.team?.captainRegistrationId && entry.team.captainRegistrationId !== entry.id) {
      const captain = await prisma.registration.findUnique({
        where: { id: entry.team.captainRegistrationId },
        select: { userId: true },
      });
      if (captain?.userId && captain.userId !== entry.userId) {
        rows.push({
          userId: captain.userId,
          type: "REMOVED_FROM_EVENT",
          title: details.replacedBy ? "Team member replaced" : "Team member removed",
          body: details.replacedBy
            ? `${organiserName} replaced ${entry.athleteName} with ${details.replacedBy} on team ${entry.team.name} for ${entry.event.title}.`
            : `${organiserName} removed ${entry.athleteName} from team ${entry.team.name} for ${entry.event.title}.`,
          eventId: entry.event.id,
        });
      }
    }
    if (rows.length > 0) await prisma.userNotification.createMany({ data: rows });
  } catch (err) {
    console.error("Removal notification failed:", entry.id, err);
  }

  try {
    await sendRemovedFromEventEmail(entry.athleteEmail, {
      athleteName: entry.athleteName,
      eventTitle: entry.event.title,
      organiserName,
      reasonLabel: details.reasonLabel,
      note: details.note,
      refundCents: details.refundCents,
      noRefund: details.noRefund,
      blocked: details.blocked,
      teamName: details.replacedBy ? entry.team?.name ?? null : null,
    });
  } catch (err) {
    console.error("Removal email failed:", entry.id, err);
  }
}
