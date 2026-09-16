import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { sendRegistrationConfirmationEmail } from "@/lib/email";
import { getCapacityError, hasCappedWave } from "@/lib/registration-capacity";
import {
  expandCompactParticipant,
  athleteNameFromParticipant,
  type CompactParticipant,
} from "@/lib/registration-form";
import { ensureAthleteCognitoUser } from "@/lib/athlete-accounts";
import { partitionByStock } from "@/lib/add-on-stock";
import { heldByVariant, stockByVariant } from "@/lib/add-on-catalogue";
import type { PricedAddOnLine } from "@/lib/add-on-pricing";

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
}

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const normalizeEmail = (email: string | undefined) => (email ?? "").trim().toLowerCase();

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
  | {
      ok: true;
      registrationIds: string[];
      /**
       * Add-on lines that lost the last-unit race and were NOT written. The
       * caller refunds these; the entries themselves are already confirmed.
       */
      droppedAddOns: PricedAddOnLine[];
    }
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
   * Priced merchandise for this order, addressed by participantIndex, which
   * lines up with `entries`. Stock-checked authoritatively inside the
   * transaction below.
   */
  addOnLines?: PricedAddOnLine[];
}): Promise<ConfirmOutcome> {
  const { event, organiserId, entries, buyerUserId, userIdByEmail, stripePaymentIntentId } = opts;
  const waves = Array.isArray(event.waves) ? (event.waves as { label: string; qty?: number }[]) : [];
  const registrationIds = entries.map(() => randomUUID());

  return prisma.$transaction(async (tx) => {
    if (opts.rejectExistingEntries) {
      const emails = [...new Set(entries.map((e) => normalizeEmail(e.participant.em)).filter(Boolean))];
      const existing = await tx.registration.findMany({
        where: { eventId: event.id, status: { not: "CANCELLED" }, athleteEmail: { in: emails, mode: "insensitive" } },
        select: { athleteEmail: true, firstName: true, lastName: true, dateOfBirth: true },
      });
      // Match on the person, not just the address: one email can legitimately
      // carry several entries (a parent registering their children).
      const identity = (email: string, first: string, last: string, dob: string) =>
        `${normalizeEmail(email)}|${first.trim().toLowerCase()}|${last.trim().toLowerCase()}|${dob}`;
      const taken = new Set(
        existing.map((r) =>
          identity(r.athleteEmail, r.firstName ?? "", r.lastName ?? "", r.dateOfBirth ?? ""),
        ),
      );
      for (const { participant } of entries) {
        const key = identity(participant.em, participant.fn, participant.ln, participant.dob);
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

    // Authoritative add-on stock check, in the transaction that just inserted
    // the entries. Unlike the capacity check above, losing here NEVER cancels
    // the order: it drops the lines that no longer fit, and the caller refunds
    // them. Voiding someone's race entry over a t-shirt, with their entry money
    // already captured, is not an acceptable outcome.
    //
    // Like the capacity check, this closes the common case rather than the last
    // microsecond: under READ COMMITTED two simultaneous transactions can both
    // observe the same held count. The blast radius is one unit oversold per
    // variant, which an organiser can absorb, so v1 does not hold stock.
    const addOnLines = opts.addOnLines ?? [];
    const droppedAddOns: PricedAddOnLine[] = [];
    if (addOnLines.length > 0) {
      const [held, stock] = await Promise.all([
        heldByVariant(event.id, tx),
        stockByVariant(event.id, tx),
      ]);
      const available = Object.fromEntries(
        Object.keys(stock).map((variantId) => [
          variantId,
          { stock: stock[variantId] ?? 0, held: held[variantId] ?? 0 },
        ]),
      );
      // A line must name a participant this order actually wrote, or there is no
      // registration to hang it on. The webhook rejects such metadata before it
      // reaches here, so this is belt and braces - but inserting an undefined
      // registrationId would throw inside the transaction and roll back entries
      // that have already been paid for, which is far worse than dropping the
      // line and refunding it.
      const addressable = addOnLines.filter((line) => registrationIds[line.participantIndex]);
      for (const line of addOnLines) {
        if (!registrationIds[line.participantIndex]) droppedAddOns.push(line);
      }

      const { fitting, dropped } = partitionByStock(addressable, available);
      droppedAddOns.push(...dropped);

      if (fitting.length > 0) {
        await tx.registrationAddOn.createMany({
          data: fitting.map((line) => ({
            registrationId: registrationIds[line.participantIndex],
            eventId: event.id,
            addOnId: line.addOnId,
            variantId: line.variantId,
            // Snapshots so a later catalogue edit cannot rewrite a receipt.
            nameSnapshot: line.name,
            optionLabelSnapshot: line.optionLabel,
            variantLabelSnapshot: line.variantLabel,
            imageUrlSnapshot: line.imageUrl,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            amountCents: line.amountCents,
            platformFeeCents: line.platformFeeCents,
            feeStructure: event.feeStructure,
            status: "PURCHASED" as const,
          })),
        });
      }
    }

    return { ok: true as const, registrationIds, droppedAddOns };
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
  /**
   * Merchandise that actually made it into the order, addressed by
   * participantIndex. Anything dropped for stock was refunded and must not
   * appear on a receipt as though it shipped.
   */
  confirmedAddOns: PricedAddOnLine[] = [],
): Promise<void> {
  const names = entries.map(({ participant }) => athleteNameFromParticipant(participant));
  const notificationBody = entries.length === 1
    ? `${names[0]} registered for ${event.title}`
    : `${entries.length} participants registered for ${event.title}: ${names.join(", ")}`;

  await prisma.notification.create({
    data: {
      organiserId,
      eventId: event.id,
      type: "NEW_REGISTRATION",
      title: entries.length === 1 ? "New registration" : "New group registration",
      body: notificationBody,
    },
  }).catch((err: unknown) => console.error("Failed to create notification:", err));

  // When the athlete absorbs the platform fee, the amount charged is
  // price + fee — the email total must reflect that, not just the ticket
  // price. When the organiser absorbs it, the athlete pays the ticket price
  // only and the service fee shown to them is $0. A free entry is $0 across
  // the board.
  const athletePaysFee = event.feeStructure === "athlete";
  entries.forEach(({ participant, waveLabel, priceCents, platformFeeCents }, participantIndex) => {
    if (!participant.em) return;
    const feeCents = athletePaysFee ? platformFeeCents : 0;

    // Each athlete sees the merchandise they chose, not the whole family's.
    const mine = confirmedAddOns.filter((line) => line.participantIndex === participantIndex);
    const addOnCents = mine.reduce((sum, line) => sum + line.chargedCents, 0);

    sendRegistrationConfirmationEmail(participant.em, {
      eventName:        event.title,
      eventDate:        event.eventDate,
      startTime:        event.startTime,
      category:         waveLabel || "General",
      location:         `${event.venue}, ${event.city} ${event.state}`,
      registrationFee:  formatCents(priceCents),
      serviceFee:       formatCents(feeCents),
      total:            formatCents(priceCents + feeCents + addOnCents),
      userEmail:        participant.em,
      ...(mine.length > 0 && {
        addOns: mine.map((line) => ({
          label: `${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ""} x ${line.quantity}`,
          amount: formatCents(line.chargedCents),
        })),
      }),
    }).catch((err) => console.error("Failed to send registration confirmation email:", err));
  });
}
