// Whether a signed-in user still owes us the onboarding the password sign-up
// flow asks for. The date of birth is the one that matters: it is the age gate,
// and it is the only required answer the password flow persists. Username is
// optional there too, so it is not part of this.
export function needsProfileOnboarding(user: { dateOfBirth?: string | null }): boolean {
  return !user.dateOfBirth;
}
