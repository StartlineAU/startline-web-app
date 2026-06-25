import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateTotalWithFee } from "@/lib/platform-fee";
import { getUserSession } from "@/lib/amplify-server";
import {
  validateParticipants,
  compactParticipant,
  athleteNameFromParticipant,
  applySharedEmergencyContact,
  type RegistrationFormData,
  type EmergencyContact,
} from "@/lib/registration-form";
import {
  getEmailsRequiringVerification,
  assertGuestEmailsVerifiedForCheckout,
} from "@/lib/guest-email-verification";

function normalizeParticipants(body: Record<string, unknown>): RegistrationFormData[] {
  if (Array.isArray(body.participants) && body.participants.length > 0) {
    return body.participants as RegistrationFormData[];
  }

  return [{
    firstName: String(body.firstName ?? ""),
    lastName: String(body.lastName ?? ""),
    dateOfBirth: String(body.dateOfBirth ?? ""),
    email: String(body.email ?? ""),
    mobile: String(body.mobile ?? ""),
    emergencyContactName: String(body.emergencyContactName ?? ""),
    emergencyContactPhone: String(body.emergencyContactPhone ?? ""),
    waiverAccepted: body.waiverAccepted === true,
  }];
}

function normalizeSharedEmergencyContact(body: Record<string, unknown>): EmergencyContact | undefined {
  const raw = body.emergencyContact;
  if (raw && typeof raw === "object") {
    const contact = raw as Record<string, unknown>;
    return {
      name: String(contact.name ?? ""),
      phone: String(contact.phone ?? ""),
    };
  }

  if (body.emergencyContactName || body.emergencyContactPhone) {
    return {
      name: String(body.emergencyContactName ?? ""),
      phone: String(body.emergencyContactPhone ?? ""),
    };
  }

  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown> & {
      eventId?: string;
      waveLabel?: string;
    };
    const { eventId, waveLabel } = body;
    const participants = normalizeParticipants(body);
    const groupRegistration = body.groupRegistration === true;
    const sharedEmergencyContact = groupRegistration
      ? normalizeSharedEmergencyContact(body)
      : undefined;

    const { firstMessage } = validateParticipants(participants, {
      groupRegistration,
      sharedEmergencyContact,
    });
    if (firstMessage) {
      return NextResponse.json({ error: firstMessage }, { status: 400 });
    }

    if (!eventId || !waveLabel) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true, title: true, status: true, feeStructure: true, registrationType: true,
        waves: true,
        organiser: { select: { id: true, stripeAccountId: true, stripeOnboardingComplete: true } },
      },
    });

    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    if (event.status !== "APPROVED") return NextResponse.json({ error: "This event is not currently accepting registrations." }, { status: 409 });
    if (event.registrationType !== "startline") return NextResponse.json({ error: "This event uses external registration." }, { status: 400 });
    if (!event.organiser.stripeOnboardingComplete || !event.organiser.stripeAccountId) {
      return NextResponse.json({ error: "This event is not ready to accept payments." }, { status: 409 });
    }

    const waves = event.waves as { label: string; price: string; qty?: number }[] | null;
    if (!Array.isArray(waves)) return NextResponse.json({ error: "No ticket tiers configured." }, { status: 400 });

    const wave = waves.find((w) => w.label === waveLabel);
    if (!wave) return NextResponse.json({ error: "Selected ticket tier not found." }, { status: 400 });

    const ticketPriceCents = Math.round(parseFloat(wave.price || "0") * 100);
    if (ticketPriceCents <= 0) return NextResponse.json({ error: "Invalid ticket price." }, { status: 400 });

    const userSession = await getUserSession();
    const emailsToVerify = getEmailsRequiringVerification(
      participants.map((participant) => participant.email),
      userSession?.email
    );
    const verificationError = await assertGuestEmailsVerifiedForCheckout(emailsToVerify, eventId);
    if (verificationError) {
      return NextResponse.json({ error: verificationError }, { status: 400 });
    }

    const perTicket = calculateTotalWithFee(ticketPriceCents, event.feeStructure);
    const participantCount = participants.length;
    const totalCents = perTicket.totalCents * participantCount;
    const platformFeeCents = perTicket.platformFeeCents * participantCount;

    const participantsForPayment =
      groupRegistration && sharedEmergencyContact
        ? applySharedEmergencyContact(participants, sharedEmergencyContact)
        : participants;

    const primary = participantsForPayment[0];
    const athleteName = athleteNameFromParticipant(primary);
    const athleteEmail = primary.email.trim().toLowerCase();

    const stripe = getStripe();

    const useDirectCharge =
      process.env.NODE_ENV === "development" &&
      process.env.STRIPE_DEV_DIRECT_CHARGE === "true";

    const participantMetadata: Record<string, string> = {
      participantCount: String(participantCount),
    };
    participantsForPayment.forEach((participant, index) => {
      participantMetadata[`participant${index}`] = JSON.stringify(compactParticipant(participant));
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "aud",
      ...(useDirectCharge
        ? {}
        : {
            application_fee_amount: platformFeeCents,
            transfer_data: { destination: event.organiser.stripeAccountId! },
          }),
      metadata: {
        eventId,
        waveLabel,
        userName: athleteName,
        userEmail: athleteEmail,
        organiserId: event.organiser.id,
        userId: userSession?.sub ?? "",
        ticketPriceCents: String(ticketPriceCents),
        platformFeeCents: String(platformFeeCents),
        platformFeeCentsPerTicket: String(perTicket.platformFeeCents),
        feeStructure: event.feeStructure,
        groupRegistration: groupRegistration ? "true" : "false",
        ...participantMetadata,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents / 100,
      platformFee: platformFeeCents / 100,
      participantCount,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Failed to create payment." }, { status: 503 });
  }
}
