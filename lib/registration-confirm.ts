import { randomUUID } from "crypto";
import type { RegistrationStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import { formatEmailPlace, googleCalendarUrl } from "@/lib/email-format";
import { getCapacityError, hasCappedWave } from "@/lib/registration-capacity";
import {
  createEmptyParticipant,
  expandCompactParticipant,
  athleteNameFromParticipant,
  splitFullName,
  type CompactParticipant,
  type RegistrationFormData,
} from "@/lib/registration-form";
import { ensureAthleteCognitoUser } from "@/lib/athlete-accounts";

/** One ticket, priced from the database rather than from the client. */
export interface PricedEntry {
  participant: CompactParticipant;
  waveLabel: string | null;
  priceCents: number;
  platformFeeCents: number;
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
function entryIdentityKey(email: string, first: string, last: string, dob: string): string {
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
 * Give every guest participant a Cognito account and a User row, so the entry
 * shows up under their account on Activity. Returns email to User id. Failures
 * are logged and skipped: a registration is never lost over account creation.
 */
export async function ensureParticipantUsers(
  entries: PricedEntry[],
): Promise<Record<string, string>> {
  const userIdByEmail: Record<string, string> = {};
  for (const { participant } of entries) {
    const email = normalizeEmail(participant.em);
    if (!email || userIdByEmail[email]) continue;

    let cognitoSub: string | null = null;
    try {
      cognitoSub = await ensureAthleteCognitoUser(email);
    } catch (err) {
      console.error(`Cognito creation failed for ${email}:`, err);
    }
    const name = athleteNameFromParticipant(participant);
    const user = await prisma.user.upsert({
      where: { email },
      update: { ...(cognitoSub && { cognitoSub }), name: name || undefined },
      create: { email, name: name || undefined, ...(cognitoSub ? { cognitoSub } : {}) },
    });
    userIdByEmail[email] = user.id;
  }
  return userIdByEmail;
}

export type ConfirmOutcome =
  | { ok: true; registrationIds: string[] }
  | { ok: false; error: string; reason: "capacity" | "duplicate" };

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
   * Defaults to every status except CANCELLED, preserving the other order
   * flows. The free RSVP passes RSVP_DUPLICATE_STATUSES so an entry that has
   * already been cancelled or refunded no longer blocks a fresh RSVP.
   */
  duplicateStatuses?: RegistrationStatus[];
}): Promise<ConfirmOutcome> {
  const { event, organiserId, entries, buyerUserId, userIdByEmail, stripePaymentIntentId } = opts;
  const waves = Array.isArray(event.waves) ? (event.waves as { label: string; qty?: number }[]) : [];
  const registrationIds = entries.map(() => randomUUID());
  const duplicateStatus = opts.duplicateStatuses
    ? { in: opts.duplicateStatuses }
    : { not: "CANCELLED" as const };

  return prisma.$transaction(async (tx) => {
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
      const emails = [...new Set(entries.map((e) => normalizeEmail(e.participant.em)).filter(Boolean))];
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
      for (const { participant } of entries) {
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

    const requestedByWave = entries.reduce<Record<string, number>>((acc, { waveLabel }) => {
      if (waveLabel) acc[waveLabel] = (acc[waveLabel] ?? 0) + 1;
      return acc;
    }, {});
    const usedLabels = Object.keys(requestedByWave);
    const needsCapCheck = event.cap != null;
    const needsWaveCheck = hasCappedWave(waves, usedLabels);
    const confirmedTotal = needsCapCheck
      ? await tx.registration.count({ where: { eventId: event.id, status: "CONFIRMED" } })
      : 0;
    const confirmedByWave: Record<string, number> = {};
    if (needsWaveCheck) {
      const grouped = await tx.registration.groupBy({
        by: ["waveLabel"],
        where: { eventId: event.id, status: "CONFIRMED" },
        _count: { _all: true },
      });
      for (const row of grouped) {
        if (row.waveLabel) confirmedByWave[row.waveLabel] = row._count._all;
      }
    }
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

    await tx.registration.createMany({
      data: entries.map(({ participant, waveLabel, priceCents, platformFeeCents }, index) => {
        const expanded = expandCompactParticipant(participant);
        const email = normalizeEmail(participant.em);
        return {
          id: registrationIds[index],
          eventId: event.id,
          organiserId,
          userId: buyerUserId || userIdByEmail[email] || null,
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
          waiverAccepted: true,
          estimatedFinishMinutes: participant.eft ?? null,
          waveLabel,
          amountCents: priceCents,
          platformFeeCents,
          feeStructure: event.feeStructure,
          status: "CONFIRMED" as const,
          stripePaymentIntentId,
        };
      }),
    });

    return { ok: true as const, registrationIds };
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
): Promise<void> {
  const names = entries.map(({ participant }) => athleteNameFromParticipant(participant));
  const notificationBody = entries.length === 1
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
        title: entries.length === 1 ? "New registration" : "New group registration",
        body: notificationBody,
      },
    }).catch((err: unknown) => console.error("Failed to create notification:", err));
  }

  // When the athlete absorbs the platform fee, the amount charged is
  // price + fee — the email total must reflect that, not just the ticket
  // price. When the organiser absorbs it, the athlete pays the ticket price
  // only and the service fee shown to them is $0. A free entry is $0 across
  // the board.
  const athletePaysFee = event.feeStructure === "athlete";
  const location = formatEmailPlace(event);
  const calendarUrl = googleCalendarUrl({
    title: event.title,
    startsAtUtc: event.startsAtUtc,
    endsAtUtc: event.endsAtUtc,
    location,
  });
  entries.forEach(({ participant, waveLabel, priceCents, platformFeeCents }) => {
    if (!participant.em) return;
    const feeCents = athletePaysFee ? platformFeeCents : 0;

    sendRegistrationConfirmationEmail(participant.em, {
      eventId:          event.id,
      eventName:        event.title,
      eventDate:        event.eventDate,
      startTime:        event.startTime,
      category:         waveLabel || "General",
      location,
      calendarUrl,
      registrationFee:  formatCents(priceCents),
      serviceFee:       formatCents(feeCents),
      total:            formatCents(priceCents + feeCents),
      userEmail:        participant.em,
    }).catch((err) => console.error("Failed to send registration confirmation email:", err));
  });
}
