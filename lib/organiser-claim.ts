import prisma from "@/lib/prisma";
import { sendOrganiserClaimEmail } from "@/lib/email";
import { newInviteToken, normaliseInviteEmail } from "@/lib/organiser-invites";
import { organiserUrl } from "@/lib/portal-domains";

/**
 * Organisations an admin creates so Startline can list events for organisers
 * who are not on the platform yet.
 *
 * Such an organisation has no members and `pendingClaim` set. The admin sends
 * an invitation with role OWNER through the same OrganiserInvite table and
 * accept page the Owner-to-Manager invitations use, so the same rules hold: the
 * link carries a token stored only as a hash, and only the signed-in account
 * whose verified email is the invited address can accept it. Accepting makes
 * that account the Owner and clears `pendingClaim`
 * (app/api/organiser/invites/accept).
 *
 * Until then the organisation gets no organiser emails
 * (lib/organiser-notification-recipients.ts): nobody there has agreed to hear
 * from Startline yet.
 */
export const CLAIM_INVITE_TTL_DAYS = 14;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function claimInviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + CLAIM_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * What /organiser-setup should do when the signed-in account's email already
 * belongs to an organisation. Its email is unique, so creating another one
 * would fail.
 */
export function setupEmailConflict(
  existing: { pendingClaim: boolean } | null,
): "none" | "claim" | "taken" {
  if (!existing) return "none";
  return existing.pendingClaim ? "claim" : "taken";
}

/**
 * Sends a new claim invitation for an unowned organisation. Any earlier
 * unaccepted claim invitation for it is withdrawn, so only the latest link
 * works. A failed email is logged, not thrown: the link is returned so an
 * admin can pass it on by hand.
 */
export async function issueClaimInvite(input: {
  organiserId: string;
  organisationName: string | null;
  email: string;
}): Promise<{ invite: { id: string; email: string; createdAt: Date; expiresAt: Date }; inviteUrl: string }> {
  const email = normaliseInviteEmail(input.email);
  const { token, tokenHash } = newInviteToken();

  const invite = await prisma.$transaction(async (tx) => {
    await tx.organiserInvite.deleteMany({
      where: { organiserId: input.organiserId, role: "OWNER", acceptedAt: null },
    });
    return tx.organiserInvite.create({
      data: {
        organiserId: input.organiserId,
        email,
        tokenHash,
        role: "OWNER",
        invitedById: null,
        expiresAt: claimInviteExpiry(),
      },
      select: { id: true, email: true, createdAt: true, expiresAt: true },
    });
  });

  const inviteUrl = organiserUrl(`/organiser/invite?token=${encodeURIComponent(token)}`, SITE);
  await sendOrganiserClaimEmail(email, {
    organisationName: input.organisationName || "Your organisation",
    inviteUrl,
    expiresInDays: CLAIM_INVITE_TTL_DAYS,
  }).catch((err: unknown) => console.error("Organiser claim email failed:", err));

  return { invite, inviteUrl };
}
