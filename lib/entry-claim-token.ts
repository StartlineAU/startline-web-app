import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * The "Add to my profile" link in an entry's confirmation email (#598).
 *
 * The buyer may have typed an address the athlete does not use for Startline,
 * so the email match in Activity never reaches their account. Whoever reads
 * that confirmation email can sign in with any account and add the race.
 *
 * The token names the registration and a hash of the address it was sent to.
 * A team swap or a details edit rewrites the same row with a new address, so
 * every link sent for the old one stops working rather than handing the new
 * athlete's race to the previous one. No expiry: results land weeks after the
 * race, and a claim only ever fills an empty `athleteUserId`.
 */

const PURPOSE = "entry-claim:v1";
/**
 * The "Request a refund" link in the same email. Its own purpose, so a
 * refund link never adds a race to a profile and a claim link never opens a
 * refund request: each signature only verifies under the purpose it was made for.
 */
const REFUND_PURPOSE = "entry-refund:v1";
let warnedMissingKey = false;

function key(): string | null {
  const value = process.env.ENTRY_CLAIM_SECRET?.trim();
  if (value) return value;
  if (!warnedMissingKey) {
    warnedMissingKey = true;
    console.warn("ENTRY_CLAIM_SECRET is not set: confirmation emails go out without an \"Add to my profile\" link.");
  }
  return null;
}

function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("base64url").slice(0, 22);
}

function mac(secret: string, purpose: string, payload: string): string {
  return createHmac("sha256", secret).update(`${purpose}.${payload}`).digest("base64url");
}

function sign(purpose: string, entry: { registrationId: string; athleteEmail: string }): string | null {
  const secret = key();
  if (!secret || !entry.registrationId || !entry.athleteEmail.trim()) return null;
  const payload = Buffer.from(JSON.stringify({ r: entry.registrationId, h: emailHash(entry.athleteEmail) })).toString("base64url");
  return `${payload}.${mac(secret, purpose, payload)}`;
}

/** A token for one entry as it stands now, or null when no key is configured. */
export function signEntryClaim(entry: { registrationId: string; athleteEmail: string }): string | null {
  return sign(PURPOSE, entry);
}

/** A refund-request token for one entry, or null when no key is configured. */
export function signEntryRefund(entry: { registrationId: string; athleteEmail: string }): string | null {
  return sign(REFUND_PURPOSE, entry);
}

/**
 * The registration id a token was issued for, when its signature holds.
 * Call `entryClaimMatches` against the row before acting on it.
 */
export function readEntryClaim(token: string | null | undefined): { registrationId: string; emailHash: string } | null {
  return read(PURPOSE, token);
}

/** As `readEntryClaim`, for a refund link. Check it with `entryClaimMatches` too. */
export function readEntryRefund(token: string | null | undefined): { registrationId: string; emailHash: string } | null {
  return read(REFUND_PURPOSE, token);
}

function read(purpose: string, token: string | null | undefined): { registrationId: string; emailHash: string } | null {
  const secret = key();
  if (!secret || !token || token.length > 512) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(mac(secret, purpose, payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof claims.r !== "string" || typeof claims.h !== "string") return null;
    return { registrationId: claims.r, emailHash: claims.h };
  } catch {
    return null;
  }
}

/** Whether a read token still describes this row: same entry, same address. */
export function entryClaimMatches(
  claim: { registrationId: string; emailHash: string },
  row: { id: string; athleteEmail: string },
): boolean {
  return claim.registrationId === row.id && claim.emailHash === emailHash(row.athleteEmail);
}
