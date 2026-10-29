import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { rateLimit } from "@/lib/rate-limit";
import { assertTurnstile } from "@/lib/turnstile";
import { isFreeEvent, waveIsOpen, type PublicWave } from "@/lib/event-types";
import {
  compactParticipant,
  createEmptyParticipant,
  splitFullName,
  athleteNameFromParticipant,
} from "@/lib/registration-form";
import {
  announceRegistrations,
  insertConfirmedRegistrations,
  type PricedEntry,
} from "@/lib/registration-confirm";

const rsvpSchema = z.object({
  eventId: z.string().min(1).max(255),
  waveLabel: z.string().min(1).max(255),
  acceptedTerms: z.boolean().refine((accepted) => accepted, {
    message: "You must accept the terms and waiver to RSVP.",
  }),
  turnstileToken: z.string().max(4000).optional(),
});

/**
 * POST — a signed-in athlete's RSVP to an event whose ticket tiers are all free.
 *
 * There is no participant form on this path: the account is the attendee, so
 * the name and email come from the authenticated session rather than from the
 * request. Pricing is still read from the database, and the write goes through
 * the same capacity and duplicate guards as every other registration.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in to RSVP for this event." }, { status: 401 });
    }

    const parsedBody = rsvpSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const body = parsedBody.data;

    const botBlocked = await assertTurnstile(req, body, "free-rsvp");
    if (botBlocked) return botBlocked;

    const blocked = await rateLimit(req, {
      prefix: "free-rsvp",
      limit: 10,
      windowSeconds: 600,
      identifier: session.sub,
    });
    if (blocked) return blocked;

    const event = await prisma.event.findUnique({
      where: { id: body.eventId },
      select: {
        id: true,
        title: true,
        status: true,
        feeStructure: true,
        registrationType: true,
        waves: true,
        cap: true,
        eventDate: true,
        startTime: true,
        venue: true,
        city: true,
        state: true,
        organiser: { select: { id: true } },
      },
    });

    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.status !== "APPROVED") {
      return NextResponse.json(
        { error: "This event is not currently accepting registrations." },
        { status: 409 },
      );
    }
    if (event.registrationType !== "startline") {
      return NextResponse.json({ error: "This event uses external registration." }, { status: 400 });
    }

    const waves = Array.isArray(event.waves) ? (event.waves as unknown as PublicWave[]) : null;
    if (!waves || !isFreeEvent(waves)) {
      return NextResponse.json(
        { error: "This event is not a free event, so it needs the standard registration flow." },
        { status: 400 },
      );
    }

    const wave = waves.find((candidate) => candidate.label === body.waveLabel);
    if (!wave) {
      return NextResponse.json({ error: "Selected ticket tier not found." }, { status: 400 });
    }
    if (!waveIsOpen(wave)) {
      return NextResponse.json(
        { error: `Ticket tier "${wave.label}" has closed.` },
        { status: 409 },
      );
    }

    // The account is the attendee. A missing display name falls back to the
    // email so the organiser always has something recognisable in the list.
    const accountName = session.name?.trim() || session.email;
    const { firstName, lastName } = splitFullName(accountName);
    const participant = {
      ...createEmptyParticipant(),
      firstName: firstName || accountName,
      lastName,
      email: session.email,
      waiverAccepted: true,
    };

    const entries: PricedEntry[] = [{
      participant: { ...compactParticipant(participant), wav: wave.label },
      waveLabel: wave.label,
      priceCents: 0,
      platformFeeCents: 0,
    }];

    const outcome = await insertConfirmedRegistrations({
      event,
      organiserId: event.organiser.id,
      entries,
      buyerUserId: session.sub,
      userIdByEmail: {},
      stripePaymentIntentId: null,
      rejectExistingEntries: true,
      rejectExistingUserEntries: true,
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: 409 });
    }

    await announceRegistrations(event, event.organiser.id, entries);

    return NextResponse.json({
      registrationIds: outcome.registrationIds,
      participantCount: 1,
      email: session.email,
      name: athleteNameFromParticipant(entries[0].participant),
    });
  } catch (err) {
    console.error("Free RSVP error:", err);
    return NextResponse.json({ error: "Failed to complete RSVP." }, { status: 503 });
  }
}
