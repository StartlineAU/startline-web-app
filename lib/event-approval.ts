import { hasAbn } from "@/lib/abn";
import { isFreeEvent } from "@/lib/event-types";

/**
 * Whether a listing takes money through Startline. Only those need the ABN and
 * the finished Stripe account: the ABN is for tax reporting on paid entries
 * (ToS 5.5) and Stripe is where the takings are paid out. A free event takes
 * neither, and requiring them left free listings in review with nothing an
 * admin could do to approve them.
 */
export function takesPayments(registrationType: string | null | undefined, waves: unknown): boolean {
  return (registrationType ?? "startline") === "startline" && !isFreeEvent(waves);
}

export interface ApprovalCandidate {
  registrationType: string | null;
  waves: unknown;
  organiser: {
    abn: string | null;
    stripeOnboardingComplete: boolean;
  };
}

/**
 * Why a marketplace listing cannot be approved yet, or null when it can. The
 * organiser is allowed to submit with these missing, so the review queue and
 * the admin preview are where the gap has to be visible: without this an admin
 * only finds out by clicking approve and reading a 422. The review and bulk
 * routes both refuse on it.
 */
export function approvalBlocker(event: ApprovalCandidate): string | null {
  if (!takesPayments(event.registrationType, event.waves)) return null;
  if (!hasAbn(event.organiser.abn)) return "No ABN on file";
  if (!event.organiser.stripeOnboardingComplete) return "Stripe onboarding incomplete";
  return null;
}
