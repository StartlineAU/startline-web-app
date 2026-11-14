import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { MAX_TEAM_NAME_LENGTH, normaliseTeamName } from "@/lib/team-tickets";
import { findTakenTeamNames } from "@/lib/team-entries";
import { getRegistrationFormErrors, createEmptyParticipant } from "@/lib/registration-form";

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

/** PATCH: rename a team, or swap one of its members for someone else. */
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
    select: { id: true, eventId: true, name: true, event: { select: { organiserId: true } } },
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

  if (name !== undefined) {
    const next = normaliseTeamName(name);
    if (!next) return NextResponse.json({ error: "Give the team a name." }, { status: 400 });
    if (next.length > MAX_TEAM_NAME_LENGTH) {
      return NextResponse.json({ error: `Team names can be at most ${MAX_TEAM_NAME_LENGTH} characters.` }, { status: 400 });
    }
    if (next.toLowerCase() !== team.name.toLowerCase()) {
      const taken = await findTakenTeamNames(id, [next]);
      if (taken) {
        return NextResponse.json({ error: `A team called "${taken}" is already entered in this event.` }, { status: 409 });
      }
    }
    await prisma.team.update({ where: { id: teamId }, data: { name: next } });
  }

  if (member) {
    const entry = await prisma.registration.findFirst({
      where: { id: member.registrationId, eventId: id, teamId },
      select: { id: true },
    });
    if (!entry) return NextResponse.json({ error: "That person is not on this team." }, { status: 404 });

    // The same checks checkout applies to a new member, minus the waiver and
    // finish estimate the organiser is not asked for.
    const errors = getRegistrationFormErrors(
      { ...createEmptyParticipant(), ...member, gender: member.gender ?? "", waiverAccepted: true },
      { includeEmergencyContact: true, includeWaiver: false },
    );
    const firstError = Object.values(errors)[0];
    if (firstError) return NextResponse.json({ error: firstError }, { status: 400 });

    const email = member.email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const firstName = member.firstName.trim();
    const lastName = member.lastName.trim();

    await prisma.registration.update({
      where: { id: entry.id },
      data: {
        athleteName: `${firstName} ${lastName}`.trim(),
        athleteEmail: email,
        firstName,
        lastName,
        dateOfBirth: member.dateOfBirth,
        gender: member.gender?.trim() || null,
        mobile: member.mobile.trim(),
        emergencyContactName: member.emergencyContactName.trim(),
        emergencyContactPhone: member.emergencyContactPhone.trim(),
        // The entry now belongs to whoever holds that email, if they have an
        // account; otherwise it waits to be claimed like any guest entry.
        userId: existingUser?.id ?? null,
        // The previous holder's details and estimate no longer apply.
        medicalNotes: null,
        estimatedFinishMinutes: null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
