import { hasAbn } from "@/lib/abn";

export interface ApprovalCandidate {
  registrationType: string | null;
  organiser: {
    abn: string | null;
    stripeOnboardingComplete: boolean;
  };
}

/**
 * Why a marketplace listing cannot be approved yet, or null when it can. The
 * organiser is allowed to submit with these missing, so the review queue and
 * the admin preview are where the gap has to be visible: without this an admin
 * only finds out by clicking approve and reading a 422. Mirrors the checks in
 * the review route.
 */
export function approvalBlocker(event: ApprovalCandidate): string | null {
  if (event.registrationType !== "startline") return null;
  if (!hasAbn(event.organiser.abn)) return "No ABN on file";
  if (!event.organiser.stripeOnboardingComplete) return "Stripe onboarding incomplete";
  return null;
}
