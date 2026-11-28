import { randomUUID } from "crypto";
import type { Prisma, RegistrationStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { entryClaimUrl, sendRegistrationConfirmationEmail, sendTeamDetailsNeededEmail } from "@/lib/email";
import { signEntryClaim } from "@/lib/entry-claim-token";
import { googleCalendarUrl } from "@/lib/email-format";
import { formatEventPlace } from "@/lib/event-place";
import { getCapacityError, hasCappedWave } from "@/lib/registration-capacity";
import { lockEventEntries } from "@/lib/event-entry-lock";
import {
  createEmptyParticipant,
  expandCompactParticipant,
  athleteNameFromParticipant,
  splitFullName,
  type CompactParticipant,
  type RegistrationFormData,
} from "@/lib/registration-form";
import { ensureAthleteCognitoUser } from "@/lib/athlete-accounts";
import {
  confirmedUnitsByWave,
  pendingMemberName,
  pendingMemberNumbers,
  requestedUnitsByWave,
  type OrderTeam,
} from "@/lib/team-tickets";
import { findTakenTeamNames } from "@/lib/team-entries";
import { BLOCKED_ENTRY_MESSAGE, findOrganiserBlock } from "@/lib/organiser-blocks";

/** One ticket, priced from the database rather than from the client. */
export interface PricedEntry {
  participant: CompactParticipant;
  waveLabel: string | null;
  priceCents: number;
  platformFeeCents: number;
  /**
   * This entry's share of the Stripe processing fee the organiser absorbs
   * (#470). Absent on the free path, where nothing is charged.
   */
  stripeFeeCents?: number;
  /** Index of this entry's team in the order, for a team-ticket member. */
  team?: number;
}

/** The event fields needed to write and announce a registration. */
export interface ConfirmEvent {
  id: string;
  title: string;
  feeStructure: string;
  waves: unknown;
  cap: number | null;
  eventDate: string;
  startTime: string;
  venue: string;
  city: string;
  state: string;
  /** For the "Add to calendar" link; the email leaves it out when absent. */
  startsAtUtc?: Date | string | null;
  endsAtUtc?: Date | string | null;
}

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const normalizeEmail = (email: string | undefined) => (email ?? "").trim().toLowerCase();

/**
 * Entries that stop the signed-in athlete from RSVPing again. A refund request
 * still holds the place until it is processed, so it blocks; a cancelled or
 * refunded entry has given the place back and does not.
 */
export const RSVP_DUPLICATE_STATUSES: RegistrationStatus[] = ["CONFIRMED", "REFUND_REQUESTED"];

/** Match on the person, not just the address: one email can carry several entries. */
export function entryIdentityKey(email: string, first: string, last: string, dob: string): string {
  return `${normalizeEmail(email)}|${first.trim().toLowerCase()}|${last.trim().toLowerCase()}|${dob}`;
}

/**
 * The attendee details for a free RSVP. The account is the attendee, so the
 * name and email come from the session and there is no date of birth.
 */
export function rsvpParticipantFromSession(session: { email: string; name?: string | null }): RegistrationFormData {
  const accountName = session.name?.trim() || session.email;
  const { firstName, lastName } = splitFullName(accountName);
  return {
    ...createEmptyParticipant(),
    firstName: firstName || accountName,
    lastName,
    email: session.email,
    waiverAccepted: true,
  };
}

/**
 * Whether the account already holds a blocking entry for this event. Mirrors
 * the duplicate checks in insertConfirmedRegistrations, including the
 * email-and-person fallback for entries created before the account was linked.
 */
export async function findBlockingRsvpRegistration(opts: {
  eventId: string;
  userId: string;
  participant: RegistrationFormData;
}): Promise<{ id: string } | null> {
  const existingForAccount = await prisma.registration.findFirst({
    where: {
      eventId: opts.eventId,
      userId: opts.userId,
      status: { in: RSVP_DUPLICATE_STATUSES },
    },
    select: { id: true },
  });
  if (existingForAccount) return existingForAccount;

  const email = normalizeEmail(opts.participant.email);
  if (!email) return null;

  const existing = await prisma.registration.findMany({
    where: {
      eventId: opts.eventId,
      status: { in: RSVP_DUPLICATE_STATUSES },
      athleteEmail: { in: [email], mode: "insensitive" },
    },
    select: {
      id: true,
      athleteEmail: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
    },
  });
  const key = entryIdentityKey(
    opts.participant.email,
    opts.participant.firstName,
    opts.participant.lastName,
    opts.participant.dateOfBirth,
  );
  return (
    existing.find(
      (row) =>
        entryIdentityKey(
          row.athleteEmail,
          row.firstName ?? "",
          row.lastName ?? "",
          row.dateOfBirth ?? "",
        ) === key,
    ) ?? null
  );
}

/**
 * Give each guest participant who has no account yet a Cognito user and a User
 * row, so the entry shows on their Activity once they sign in. Returns email to
 * User id for the accounts created here.
 *
 * Nobody checks that a guest owns the addresses they type, so an address that
 * already has an account is left completely alone: its name, its Cognito link
 * and its entries list are not touched, and the entry is not linked to it. The
 * owner still sees the entry, because Activity and check-in also match entries
 * by the account's verified email.
 *
 * Failures are logged and skipped: a registration is never lost over account
 * creation.
 */
export async function ensureParticipantUsers(
  entries: PricedEntry[],
): Promise<Record<string, string>> {
  const userIdByEmail: Record<string, string> = {};
  const seen = new Set<string>();
  for (const { participant } of entries) {
    // A place left for later is the buyer's, whose account the buyer's own
    // entry already covers.
    if (participant.pnd) continue;
    const email = normalizeEmail(participant.em);
    if (!email || seen.has(email)) continue;
    seen.add(email);

    try {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) continue;

      const cognitoSub = await ensureAthleteCognitoUser(email);
      if (!cognitoSub) continue;

      const name = athleteNameFromParticipant(participant);
      const user = await prisma.user.create({
        data: { email, name: name || undefined, cognitoSub },
        select: { id: true },
      });
      userIdByEmail[email] = user.id;
    } catch (err) {
      console.error("Guest account creation failed:", err);
    }
  }
  return userIdByEmail;
}

export type ConfirmOutcome =
  // alreadyRecorded: rows for this PaymentIntent already exist (a webhook
  // redelivery), so nothing was written and nothing should be announced.
  | { ok: true; registrationIds: string[]; alreadyRecorded?: boolean }
  | { ok: false; error: string; reason: "capacity" | "duplicate" | "stale" | "blocked" };

/**
 * Write the registrations for an order.
 *
 * The capacity check runs inside the same transaction as the insert, so two
 * concurrent orders can never both pass the count and oversell the event.
 */
export async function insertConfirmedRegistrations(opts: {
  event: ConfirmEvent;
  organiserId: string;
  entries: PricedEntry[];
  /** User id of the signed-in buyer, or "" when the order is a guest checkout. */
  buyerUserId: string;
  /** Guest accounts created by ensureParticipantUsers, keyed by email. */
  userIdByEmail: Record<string, string>;
  stripePaymentIntentId: string | null;
  /**
   * Whether the athlete accepted the terms and the event waiver for this order,
   * as recorded by the server: the free paths require it in the request, a paid
   * order carries it on its PaymentIntent. Stored as is, never assumed.
   */
  termsAccepted: boolean;
  /**
   * Refuse an entry for someone who already holds one for this event. A paid
   * order is protected from double submission by its PaymentIntent, which is
   * created once and checked for on the way in; a free order has no such token,
   * so the guard is the athlete's own identity.
   */
  rejectExistingEntries?: boolean;
  /**
   * Refuse a second entry for the signed-in account. A free RSVP carries no
   * name or date of birth from the athlete, so the email-and-person check above
   * cannot see an earlier RSVP that was stored with a date of birth.
   */
  rejectExistingUserEntries?: boolean;
  /**
   * Statuses that count as an existing entry for the duplicate guards above.
   * Defaults to every status except CANCELLED and REMOVED, preserving the
   * other order flows. A removed entry does not stop a fresh one by itself:
   * the organisation's block list does that. The free RSVP passes RSVP_DUPLICATE_STATUSES so an entry that has
   * already been cancelled or refunded no longer blocks a fresh RSVP.
   */
  duplicateStatuses?: RegistrationStatus[];
  /**
   * Teams in the order, from groupOrderTeams. Each becomes a Team row and its
   * members' entries are linked to it. The first member is the captain.
   */
  teams?: OrderTeam[];
  /**
   * Runs under the event lock, after the PaymentIntent idempotency check and
   * before anything is inserted. The paid webhook re-reads the event here: a
   * price or status change while guest accounts are being created must refuse
   * the order, not confirm it. Return an error to abort without writing.
   */
  beforeInsert?: (tx: Prisma.TransactionClient) => Promise<string | null>;
}): Promise<ConfirmOutcome> {
  const { event, organiserId, entries, buyerUserId, userIdByEmail, stripePaymentIntentId } = opts;
  const waves = Array.isArray(event.waves) ? (event.waves as { label: string; qty?: number }[]) : [];
  const registrationIds = entries.map(() => randomUUID());
  const duplicateStatus = opts.duplicateStatuses
    ? { in: opts.duplicateStatuses }
    : { notIn: ["CANCELLED", "REMOVED"] as RegistrationStatus[] };

  return prisma.$transaction(async (tx) => {
    // Confirms for one event run one at a time. Every check below (duplicate
    // entries, team names, tier and event capacity) reads rows and then
    // writes; under READ COMMITTED two concurrent confirms could both pass and
    // both write, overselling a tier or entering two teams with one name.
    // Every writer that can add or change an entry takes this same lock.
    await lockEventEntries(tx, event.id);

    // A PaymentIntent belongs to one event, so under that event's lock this
    // check cannot race another delivery of the same payment.
    if (stripePaymentIntentId) {
      const recorded = await tx.registration.count({ where: { stripePaymentIntentId } });
      if (recorded > 0) return { ok: true as const, registrationIds: [], alreadyRecorded: true };
    }

    if (opts.beforeInsert) {
      const stale = await opts.beforeInsert(tx);
      if (stale) return { ok: false as const, reason: "stale" as const, error: stale };
    }

    // Every path that creates an entry comes through here, so this is the
    // backstop for the organisation's block list (#571). The routes check
    // earlier too, so a blocked person is normally stopped before paying.
    const block = await findOrganiserBlock(
      organiserId,
      {
        userIds: [buyerUserId, ...Object.values(userIdByEmail)],
        emails: entries.filter((e) => !e.participant.pnd).map((e) => e.participant.em),
      },
      tx,
    );
    if (block) return { ok: false as const, reason: "blocked" as const, error: BLOCKED_ENTRY_MESSAGE };

    if (opts.rejectExistingUserEntries && buyerUserId) {
      const existingForAccount = await tx.registration.findFirst({
        where: { eventId: event.id, userId: buyerUserId, status: duplicateStatus },
        select: { id: true },
      });
      if (existingForAccount) {
        return {
          ok: false as const,
          reason: "duplicate" as const,
          error: "You are already registered for this event.",
        };
      }
    }

    if (opts.rejectExistingEntries) {
      // A place left for later names nobody yet, so it cannot duplicate anyone.
      const named = entries.filter((e) => !e.participant.pnd);
      const emails = [...new Set(named.map((e) => normalizeEmail(e.participant.em)).filter(Boolean))];
      const existing = await tx.registration.findMany({
        where: { eventId: event.id, status: duplicateStatus, athleteEmail: { in: emails, mode: "insensitive" } },
        select: { athleteEmail: true, firstName: true, lastName: true, dateOfBirth: true },
      });
      // Match on the person, not just the address: one email can legitimately
      // carry several entries (a parent registering their children).
      const taken = new Set(
        existing.map((r) =>
          entryIdentityKey(r.athleteEmail, r.firstName ?? "", r.lastName ?? "", r.dateOfBirth ?? ""),
        ),
      );
      for (const { participant } of named) {
        const key = entryIdentityKey(participant.em, participant.fn, participant.ln, participant.dob);
        if (taken.has(key)) {
          return {
            ok: false as const,
            reason: "duplicate" as const,
            error: `${athleteNameFromParticipant(participant)} is already registered for this event.`,
          };
        }
        // Catches duplicates inside a single order too.
        taken.add(key);
      }
    }

    const teams = opts.teams ?? [];
    if (teams.length > 0) {
      const taken = await findTakenTeamNames(event.id, teams.map((t) => t.name), tx);
      if (taken) {
        return {
          ok: false as const,
          reason: "duplicate" as const,
          error: `A team called "${taken}" is already entered in this event.`,
        };
      }
    }

    // Tier quantities count tickets, or teams for a team tier.
    const requestedByWave = requestedUnitsByWave(entries);
    const usedLabels = Object.keys(requestedByWave);
    const needsCapCheck = event.cap != null;
    const needsWaveCheck = hasCappedWave(waves, usedLabels);
    const confirmedTotal = needsCapCheck
      ? await tx.registration.count({ where: { eventId: event.id, status: "CONFIRMED" } })
      : 0;
    const confirmedRows = needsWaveCheck
      ? await tx.registration.groupBy({
          by: ["waveLabel", "teamId"],
          where: { eventId: event.id, status: "CONFIRMED" },
          _count: { _all: true },
        })
      : [];
    const confirmedByWave = confirmedUnitsByWave(confirmedRows);
    const capacityError = getCapacityError({
      cap: event.cap,
      confirmedTotal,
      requestedTotal: entries.length,
      waves,
      usedLabels,
      confirmedByWave,
      requestedByWave,
    });
    if (capacityError) {
      return { ok: false as const, reason: "capacity" as const, error: capacityError };
    }

    // Team rows first, so each member's entry can point at its team.
    const teamIdByIndex = new Map<number, string>();
    for (const team of teams) {
      const id = randomUUID();
      teamIdByIndex.set(team.index, id);
      await tx.team.create({
        data: {
          id,
          eventId: event.id,
          name: team.name,
          ticketLabel: team.waveLabel,
          size: team.size,
          captainRegistrationId: registrationIds[team.members[0]],
        },
      });
    }

    // "Team member N" for each place left for later.
    const memberNumbers = pendingMemberNumbers(teams, (i) => entries[i]?.participant.pnd === 1);
    const athleteUserIds = athleteUserIdsFor(entries, buyerUserId, userIdByEmail);

    await tx.registration.createMany({
      data: entries.map(({ participant, waveLabel, priceCents, platformFeeCents, stripeFeeCents, team }, index) => {
        const email = normalizeEmail(participant.em);
        if (participant.pnd) {
          // A team place with nobody named yet: it holds the buyer's email and
          // account until the member's details are added.
          return {
            id: registrationIds[index],
            eventId: event.id,
            organiserId,
            userId: buyerUserId || userIdByEmail[email] || null,
            athleteName: pendingMemberName(memberNumbers.get(index) ?? index + 1),
            athleteEmail: email,
            detailsPending: true,
            waiverAccepted: true,
            waveLabel,
            amountCents: priceCents,
            platformFeeCents,
            stripeFeeCents: stripeFeeCents ?? 0,
            feeStructure: event.feeStructure,
            status: "CONFIRMED" as const,
            stripePaymentIntentId,
            teamId: team != null ? teamIdByIndex.get(team) ?? null : null,
          };
        }
        const expanded = expandCompactParticipant(participant);
        return {
          id: registrationIds[index],
          eventId: event.id,
          organiserId,
          userId: buyerUserId || userIdByEmail[email] || null,
          athleteUserId: athleteUserIds[index],
          athleteName: athleteNameFromParticipant(participant),
          athleteEmail: participant.em,
          firstName: expanded.firstName,
          lastName: expanded.lastName,
          dateOfBirth: expanded.dateOfBirth,
          gender: expanded.gender || null,
          mobile: expanded.mobile,
          emergencyContactName: expanded.emergencyContactName,
          emergencyContactPhone: expanded.emergencyContactPhone,
          medicalNotes: expanded.medicalNotes || null,
          waiverAccepted: opts.termsAccepted,
          estimatedFinishMinutes: participant.eft ?? null,
          waveLabel,
          amountCents: priceCents,
          platformFeeCents,
          stripeFeeCents: stripeFeeCents ?? 0,
          feeStructure: event.feeStructure,
          status: "CONFIRMED" as const,
          stripePaymentIntentId,
          teamId: team != null ? teamIdByIndex.get(team) ?? null : null,
        };
      }),
    });

    return { ok: true as const, registrationIds };
  });
}

/**
 * Which ticket was the signed-in buyer's own on an order created before the
 * "Me" flag existed. Mirrors the #592 backfill: a named entry on the
 * account's email, the one whose name matches the account's if there are
 * several (a parent entering their children on one address), else the first.
 * Null when no entry is on the buyer's address.
 */
export function legacySelfIndex(
  participants: CompactParticipant[],
  buyer: { email: string; name: string | null },
): number | null {
  const email = normalizeEmail(buyer.email);
  if (!email) return null;
  const candidates = participants
    .map((participant, index) => ({ participant, index }))
    .filter(({ participant }) => !participant.pnd && normalizeEmail(participant.em) === email);
  if (candidates.length === 0) return null;
  const name = buyer.name?.trim().toLowerCase();
  const byName = name
    ? candidates.find(({ participant }) => athleteNameFromParticipant(participant).trim().toLowerCase() === name)
    : undefined;
  return (byName ?? candidates[0]).index;
}

/**
 * The account racing in each entry, aligned with `entries` (#592). Every
 * entry's userId is the buyer's, so this is what a profile's race history
 * reads.
 *
 * - A signed-in buyer's own ticket (`me`) is theirs.
 * - A guest checkout's accounts were created here for that address, so the
 *   first named entry on each address is that account's. Later ones on the
 *   same address (a parent's children) are not.
 * - Everyone else is null: a guest's address is not verified, so it is never
 *   linked to an account here. Their account finds the entry by its verified
 *   email instead, the way Activity does.
 */
export function athleteUserIdsFor(
  entries: Pick<PricedEntry, "participant">[],
  buyerUserId: string,
  userIdByEmail: Record<string, string>,
): (string | null)[] {
  if (buyerUserId) {
    let claimed = false;
    return entries.map(({ participant }) => {
      if (claimed || participant.me !== 1 || participant.pnd) return null;
      claimed = true;
      return buyerUserId;
    });
  }
  const seen = new Set<string>();
  return entries.map(({ participant }) => {
    if (participant.pnd) return null;
    const email = normalizeEmail(participant.em);
    if (!email || seen.has(email)) return null;
    seen.add(email);
    return userIdByEmail[email] ?? null;
  });
}

/**
 * Tell the organiser and email the athletes. Best-effort throughout: the
 * registrations are already written, so nothing here may throw back at the
 * caller.
 */
export async function announceRegistrations(
  event: ConfirmEvent,
  organiserId: string,
  entries: PricedEntry[],
  teams: OrderTeam[] = [],
  /** The written entries' ids, aligned with `entries`, from the confirm step. */
  registrationIds: string[] = [],
): Promise<void> {
  const named = entries.filter(({ participant }) => !participant.pnd);
  const pendingCount = entries.length - named.length;
  const names = named.map(({ participant }) => athleteNameFromParticipant(participant));
  const teamByIndex = new Map(teams.map((t) => [t.index, t]));
  const nameList = names.join(", ") + (pendingCount > 0 ? ` (+${pendingCount} to name later)` : "");
  const notificationBody = teams.length > 0
    ? `${teams.length === 1 ? `Team ${teams[0].name}` : `${teams.length} teams (${teams.map((t) => t.name).join(", ")})`} registered for ${event.title}: ${nameList}`
    : entries.length === 1
      ? `${names[0]} registered for ${event.title}`
      : `${entries.length} participants registered for ${event.title}: ${names.join(", ")}`;

  // The organisation can turn registration notifications off. If the lookup
  // fails, tell them anyway: a missed notification is worse than an extra one.
  let notifyOrganiser = true;
  try {
    const organiser = await prisma.organiser.findUnique({
      where: { id: organiserId },
      select: { notifyNewRegistration: true },
    });
    notifyOrganiser = organiser?.notifyNewRegistration !== false;
  } catch (err) {
    console.error("Failed to read notification preferences:", err);
  }

  if (notifyOrganiser) {
    await prisma.notification.create({
      data: {
        organiserId,
        eventId: event.id,
        type: "NEW_REGISTRATION",
        title: teams.length > 0
          ? "New team registration"
          : entries.length === 1 ? "New registration" : "New group registration",
        body: notificationBody,
      },
    }).catch((err: unknown) => console.error("Failed to create notification:", err));
  }

  entries.forEach(({ participant, waveLabel, priceCents, platformFeeCents, team }, index) => {
    const entryTeam = team != null ? teamByIndex.get(team) : undefined;
    // A place left for later has nobody to confirm to yet: its member gets
    // this email when their details are added.
    if (!participant.em || participant.pnd) return;
    void sendEntryConfirmation(event, {
      registrationId: registrationIds[index],
      email: participant.em,
      waveLabel,
      priceCents,
      platformFeeCents,
      team: entryTeam ? { name: entryTeam.name, size: entryTeam.size } : null,
    });
  });

  if (pendingCount > 0) await askBuyerForTeamDetails(event, entries, teams, registrationIds);
}

/**
 * Tell the buyer which team places still need a member's details: by email,
 * and in their Activity notifications when the places sit on an account.
 * Best-effort: logs and never throws.
 */
async function askBuyerForTeamDetails(
  event: ConfirmEvent,
  entries: PricedEntry[],
  teams: OrderTeam[],
  registrationIds: string[],
): Promise<void> {
  const firstPending = entries.findIndex(({ participant }) => participant.pnd);
  const buyerEmail = normalizeEmail(entries[firstPending]?.participant.em);
  if (!buyerEmail) return;
  const summary = teams
    .map((t) => ({
      name: t.name,
      size: t.size,
      missing: t.members.filter((i) => entries[i]?.participant.pnd).length,
    }))
    .filter((t) => t.missing > 0);
  const missing = summary.reduce((sum, t) => sum + t.missing, 0);
  const buyer = entries.find(({ participant }) => !participant.pnd && normalizeEmail(participant.em) === buyerEmail);

  try {
    await sendTeamDetailsNeededEmail(buyerEmail, {
      buyerName: buyer ? athleteNameFromParticipant(buyer.participant) : null,
      eventTitle: event.title,
      eventDate: event.eventDate,
      teams: summary,
    });
  } catch (err) {
    console.error("Failed to send team details email:", err);
  }

  try {
    const placeId = registrationIds[firstPending];
    const place = placeId
      ? await prisma.registration.findUnique({ where: { id: placeId }, select: { userId: true } })
      : null;
    if (place?.userId) {
      await prisma.userNotification.create({
        data: {
          userId: place.userId,
          type: "TEAM_DETAILS_NEEDED",
          eventId: event.id,
          title: "Add your team's details",
          body: `${missing === 1 ? "One team member still needs" : `${missing} team members still need`} their details for ${event.title}. Add them from Activity.`,
        },
      });
    }
  } catch (err) {
    console.error("Failed to create team details notification:", err);
  }
}

/**
 * Email one entry its confirmation. Best-effort: logs and never throws.
 *
 * When the athlete absorbs the platform fee, the amount charged is
 * price + fee, and the email total reflects that. When the organiser absorbs
 * it, the athlete pays the ticket price only and the service fee shown to them
 * is $0. A free entry is $0 across the board.
 */
export async function sendEntryConfirmation(
  event: ConfirmEvent,
  entry: {
    /** The written entry, for its "Add to my profile" link. */
    registrationId: string;
    email: string;
    waveLabel: string | null;
    priceCents: number;
    platformFeeCents: number;
    team?: { name: string; size: number } | null;
  },
): Promise<void> {
  const token = signEntryClaim({ registrationId: entry.registrationId, athleteEmail: entry.email });
  const claimUrl = token ? entryClaimUrl(token) : null;
  const athletePaysFee = event.feeStructure === "athlete";
  const feeCents = athletePaysFee ? entry.platformFeeCents : 0;
  const location = formatEventPlace(event);
  const calendarUrl = googleCalendarUrl({
    title: event.title,
    startsAtUtc: event.startsAtUtc,
    endsAtUtc: event.endsAtUtc,
    location,
  });
  try {
    await sendRegistrationConfirmationEmail(entry.email, {
      eventId:          event.id,
      eventName:        event.title,
      eventDate:        event.eventDate,
      startTime:        event.startTime,
      category:         entry.waveLabel || "General",
      location,
      calendarUrl,
      claimUrl,
      ...(entry.team ? { team: `${entry.team.name} (team of ${entry.team.size})` } : {}),
      registrationFee:  formatCents(entry.priceCents),
      serviceFee:       formatCents(feeCents),
      total:            formatCents(entry.priceCents + feeCents),
      userEmail:        entry.email,
    });
  } catch (err) {
    console.error("Failed to send registration confirmation email:", err);
  }
}
