// The age gate. Shared by the sign-up modal, the social onboarding page and the
// profile API, so a client-side check can never be the only one. 18 matches the
// Terms of Service and the Stripe account requirement.
export const MIN_AGE = 18;

/** Whole years old for an ISO `yyyy-mm-dd` date, or null if it is not a real date. */
export function calcAge(iso: string, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const dob = new Date(Date.UTC(year, month - 1, day));
  // Rejects 1990-02-31 and friends, which Date rolls over silently.
  if (dob.getUTCFullYear() !== year || dob.getUTCMonth() !== month - 1 || dob.getUTCDate() !== day) {
    return null;
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dob > today) return null;

  const beforeBirthday =
    today.getUTCMonth() < month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() < day);

  return today.getUTCFullYear() - year - (beforeBirthday ? 1 : 0);
}

export function isAtLeastYearsOld(iso: string, years: number = MIN_AGE): boolean {
  const age = calcAge(iso);
  return age !== null && age >= years;
}
