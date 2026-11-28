import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { entryClaimMatches, readEntryClaim } from "@/lib/entry-claim-token";
import ClaimRaceClient, { type ClaimSummary } from "./ClaimRaceClient";

// The token is a bearer link for one entry: keep it out of search results and
// out of the Referer sent to anything the page loads.
export const metadata: Metadata = {
  title: "Add a race to your profile",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Where the "Add to my profile" link in a confirmation email lands (#598).
 *
 * Opening it never adds anything: mail scanners fetch links before people
 * do. The athlete signs in and presses the button, which POSTs the token to
 * /api/user/registrations/[id]/claim.
 */
export default async function ClaimRacePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" ? raw : null;
  if (!token) return <ClaimRaceClient token={null} summary={null} />;

  const claim = readEntryClaim(token);
  const row = claim
    ? await prisma.registration.findUnique({
        where: { id: claim.registrationId },
        select: {
          id: true,
          athleteEmail: true,
          athleteName: true,
          status: true,
          event: { select: { id: true, title: true, eventDate: true, city: true, state: true } },
        },
      })
    : null;
  // A swapped place or an edited address voids the link, as does a withdrawal.
  const valid = claim && row && entryClaimMatches(claim, row) && row.status === "CONFIRMED";
  if (!valid) return <ClaimRaceClient token={token} summary={null} />;

  const summary: ClaimSummary = {
    registrationId: row.id,
    athleteName: row.athleteName,
    eventId: row.event.id,
    eventTitle: row.event.title,
    eventDate: row.event.eventDate,
    place: [row.event.city, row.event.state].filter(Boolean).join(", "),
  };
  return <ClaimRaceClient token={token} summary={summary} />;
}
