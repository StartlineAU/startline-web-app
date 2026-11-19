import { createHash, randomBytes } from "crypto";

/**
 * Invitations to join an organisation as a MANAGER.
 *
 * Adding someone straight to an organisation let an Owner put anyone in it
 * without their agreement, and each unwanted membership counted against that
 * person's MAX_ORGS_PER_USER. Now the Owner sends an invitation and nothing
 * happens until the invitee, signed in with the invited address, accepts it.
 *
 * The link carries a random token; only its SHA-256 is stored, so the table
 * leaking does not hand out working links. The token alone is not enough
 * either: accepting needs the session of the invited address.
 */
export const INVITE_TTL_DAYS = 7;

export function newInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function normaliseInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type InviteState = "pending" | "accepted" | "expired";

export function inviteState(
  invite: { acceptedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): InviteState {
  if (invite.acceptedAt) return "accepted";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

/** Whether the signed-in account is the one the invitation was sent to. */
export function inviteIsFor(invite: { email: string }, sessionEmail: string | null | undefined): boolean {
  return Boolean(sessionEmail) && normaliseInviteEmail(sessionEmail!) === normaliseInviteEmail(invite.email);
}
