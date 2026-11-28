import prisma from "@/lib/prisma";
import { entryClaimMatches, readEntryRefund } from "@/lib/entry-claim-token";

/**
 * The entry a "Request a refund" link from a confirmation email stands for.
 *
 * Someone else may have entered the athlete under an address they do not sign
 * in to Startline with, so their account never sees the entry as theirs. The
 * link proves they can read the inbox the entry was sent to, which is the
 * same proof the "Add to my profile" link rests on, without adding anything
 * to a profile.
 *
 * Null unless the signature holds, the entry still carries the address the
 * link was sent to (a team swap or details edit retires old links), and it is
 * a confirmed, paid entry.
 */
export interface RefundLinkEntry {
  registrationId: string;
  athleteName: string;
  athleteEmail: string;
  event: { id: string; title: string; eventDate: string; city: string | null; state: string | null };
}

export async function refundLinkEntry(token: string | null | undefined): Promise<RefundLinkEntry | null> {
  const claim = readEntryRefund(token);
  if (!claim) return null;
  const row = await prisma.registration.findUnique({
    where: { id: claim.registrationId },
    select: {
      id: true,
      athleteName: true,
      athleteEmail: true,
      status: true,
      amountCents: true,
      event: { select: { id: true, title: true, eventDate: true, city: true, state: true } },
    },
  });
  if (!row || !entryClaimMatches(claim, row)) return null;
  if (row.status !== "CONFIRMED" || row.amountCents <= 0) return null;
  return {
    registrationId: row.id,
    athleteName: row.athleteName,
    athleteEmail: row.athleteEmail,
    event: row.event,
  };
}
