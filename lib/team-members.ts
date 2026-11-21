import prisma from "@/lib/prisma";
import { entryIdentityKey } from "@/lib/registration-confirm";
import { TEAM_HELD_STATUSES } from "@/lib/team-tickets";
import {
  calcAgeFromIsoDate,
  getRegistrationFormErrors,
  MAX_MEDICAL_NOTES_LENGTH,
  parseFinishToMinutes,
  type RegistrationFormData,
} from "@/lib/registration-form";

/**
 * Putting a person into a team place after checkout: an organiser swapping a
 * member, or the buyer adding the details of a member they left for later.
 */

/**
 * Another entry in this event, still holding a place, for the same person
 * (email, name and date of birth, matched as checkout matches them).
 */
export async function findHeldEntryFor(
  eventId: string,
  excludeId: string,
  person: Pick<RegistrationFormData, "email" | "firstName" | "lastName" | "dateOfBirth">,
  db: Pick<typeof prisma, "registration"> = prisma,
): Promise<{ athleteName: string; teamName: string | null } | null> {
  const rows = await db.registration.findMany({
    where: {
      eventId,
      id: { not: excludeId },
      status: { in: TEAM_HELD_STATUSES },
      detailsPending: false,
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

/**
 * The first problem with a member's details, or null. The checks checkout
 * applies, plus the event's own minimum age, which checkout enforces through
 * the date picker and nothing here would otherwise.
 */
export function memberDetailsError(person: RegistrationFormData, minAge?: number | null): string | null {
  const errors = getRegistrationFormErrors(person, { includeEmergencyContact: true, includeWaiver: false });
  const first = Object.values(errors)[0];
  if (first) return first;
  if (minAge && minAge > 0) {
    const age = calcAgeFromIsoDate(person.dateOfBirth);
    if (Number.isFinite(age) && age < minAge) return `Participants must be at least ${minAge} years old for this event.`;
  }
  return null;
}

/** The registration columns a member's details fill, trimmed. */
export function memberDetailsData(person: RegistrationFormData) {
  const firstName = person.firstName.trim();
  const lastName = person.lastName.trim();
  return {
    athleteName: `${firstName} ${lastName}`.trim(),
    athleteEmail: person.email.trim().toLowerCase(),
    firstName,
    lastName,
    dateOfBirth: person.dateOfBirth,
    gender: person.gender.trim() || null,
    mobile: person.mobile.trim(),
    emergencyContactName: person.emergencyContactName.trim(),
    emergencyContactPhone: person.emergencyContactPhone.trim(),
  };
}

/** Medical notes and finish estimate, which only the member's own form asks for. */
export function memberExtrasData(person: RegistrationFormData) {
  return {
    medicalNotes: person.medicalNotes.trim().slice(0, MAX_MEDICAL_NOTES_LENGTH) || null,
    estimatedFinishMinutes: parseFinishToMinutes(person.estimatedFinish),
  };
}
