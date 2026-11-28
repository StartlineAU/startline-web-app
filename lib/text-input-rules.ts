/**
 * Character rules for the free-text fields athletes fill in at registration:
 * their own name, their emergency contact, phone numbers and team names.
 *
 * These are not what keeps the app safe. Prisma parameterises every query,
 * React escapes what it renders, email templates escape their values and
 * exports go through `escapeCsvCell`. What these rules stop is junk that
 * reaches an organiser's start list, a bib, a results sheet or another
 * athlete's ticket: markup-looking strings, `=` and `;` fragments, control and
 * zero-width characters that make two names look identical.
 *
 * Every rule is an allowlist and Unicode-aware, so accented and non-Latin
 * names (Zoë, Nguyễn, O'Brien, 김민준) still pass.
 *
 * Pure and client-safe: the register page, the team member dialog, checkout
 * and the organiser team routes all read these.
 */

// A name is letters joined by spaces, apostrophes, hyphens and full stops.
const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;

// An emergency contact is often written with who they are: "Jane (Mum)",
// "Mum & Dad".
const CONTACT_NAME = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-()&,]*$/u;

// Team names are letters, numbers and spaces, nothing else.
const TEAM_NAME = /^[\p{L}\p{M}\p{Nd}][\p{L}\p{M}\p{Nd} ]*$/u;

const PHONE_CHARS = /^\+?[\d\s()\-]+$/;
const PHONE_MIN_DIGITS = 6;
const PHONE_MAX_DIGITS = 15; // E.164

export const PERSON_NAME_HINT = "Use letters, spaces, apostrophes, hyphens and full stops only.";
export const CONTACT_NAME_HINT = "Use letters, spaces and basic punctuation only.";
export const TEAM_NAME_HINT = "Use letters, numbers and spaces only.";
export const PHONE_HINT = "Enter a valid phone number using digits, spaces and an optional leading +.";

/** True when a trimmed name is made only of the characters a name can hold. */
export function isValidPersonName(value: string): boolean {
  return PERSON_NAME.test(value.trim());
}

export function isValidContactName(value: string): boolean {
  return CONTACT_NAME.test(value.trim());
}

/** Checks a team name already passed through `normaliseTeamName`. */
export function isValidTeamName(value: string): boolean {
  return TEAM_NAME.test(value);
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!PHONE_CHARS.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "").length;
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}
