import prisma from "@/lib/prisma";
import { racePhase } from "@/lib/profile-history";

/**
 * The athlete's personal summary of a race they finished (#561):
 * /races/[registrationId].
 *
 * Visibility follows the profile the race sits on. Its owner always sees it;
 * anyone else only while that profile is public, which already shows the same
 * time and placing in its race history. The entry is the race of:
 *
 * - the account recorded as racing it (`athleteUserId`), or
 * - an account whose email someone else entered it under, not yet claimed.
 *
 * Those are the two branches of `profileHistoryWhere` (lib/profile-history.ts),
 * so a race opens here exactly when it is listed on a profile. The buyer of a
 * ticket for somebody else is not the athlete and does not get the page.
 */

export interface RaceSummary {
  registrationId: string;
  isOwner: boolean;
  /** The profile handle, for "back to profile". Null for an owner without one. */
  username: string | null;
  /** What the page calls the athlete: the handle, or for the owner their name. */
  athleteLabel: string;
  resultTime: string | null;
  resultPlacement: string | null;
  resultDistance: string | null;
  isPersonalBest: boolean;
  isTopResult: boolean;
  /** Start wave, else the ticket the athlete bought. */
  wave: string | null;
  /** Owner only. */
  bibNumber: string | null;
  /** Owner only. */
  teamName: string | null;
  event: {
    id: string;
    slug: string | null;
    title: string;
    discipline: string;
    eventDate: string;
    venue: string;
    city: string;
    state: string;
    coverImageUrl: string | null;
    organiser: { id: string; orgName: string | null; logoUrl: string | null };
  };
}

export type RaceSummaryResult =
  | { kind: "not_found" }
  /** The race has not finished: the event page is still the right place. */
  | { kind: "not_finished"; eventPath: string }
  | { kind: "ok"; summary: RaceSummary };

interface RaceAccount {
  id: string;
  username: string | null;
  name: string | null;
  isPublic: boolean;
}

const ACCOUNT_SELECT = { id: true, username: true, name: true, isPublic: true } as const;

/** Whose race this entry is, by the profile rule. Null when it is nobody's. */
async function raceAccount(entry: {
  athleteUserId: string | null;
  userId: string | null;
  athleteEmail: string;
  detailsPending: boolean;
}): Promise<RaceAccount | null> {
  if (entry.athleteUserId) {
    return prisma.user.findUnique({ where: { id: entry.athleteUserId }, select: ACCOUNT_SELECT });
  }
  // A "details later" team place still carries the buyer's email.
  if (entry.detailsPending || !entry.athleteEmail) return null;
  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: entry.athleteEmail, mode: "insensitive" } },
    select: ACCOUNT_SELECT,
  });
  // The buyer's own purchase under their own email is not their race unless
  // it was marked as theirs (a child entered on a parent's address).
  if (!byEmail || entry.userId === byEmail.id) return null;
  return byEmail;
}

export async function getRaceSummary(
  registrationId: string,
  viewerId: string | null,
  now = Date.now(),
): Promise<RaceSummaryResult> {
  const entry = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      userId: true,
      athleteUserId: true,
      athleteName: true,
      athleteEmail: true,
      detailsPending: true,
      resultTime: true,
      resultPlacement: true,
      resultDistance: true,
      isPersonalBest: true,
      isTopResult: true,
      startWaveLabel: true,
      waveLabel: true,
      bibNumber: true,
      team: { select: { name: true, bibNumber: true } },
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          discipline: true,
          eventDate: true,
          venue: true,
          city: true,
          state: true,
          coverImageUrl: true,
          status: true,
          startsAtUtc: true,
          endsAtUtc: true,
          organiser: { select: { id: true, orgName: true, logoUrl: true } },
        },
      },
    },
  });
  if (!entry || entry.status !== "CONFIRMED") return { kind: "not_found" };

  const account = await raceAccount(entry);
  if (!account) return { kind: "not_found" };

  const isOwner = viewerId != null && viewerId === account.id;
  // A private profile, or one with no handle to show, is the owner's alone.
  if (!isOwner && (!account.isPublic || !account.username)) return { kind: "not_found" };

  const { status, startsAtUtc, endsAtUtc, ...event } = entry.event;
  // A cancelled event is "ended" to registration, but nobody raced it.
  if (status === "CANCELLED" || racePhase({ status, startsAtUtc, endsAtUtc }, now) !== "ended") {
    return { kind: "not_finished", eventPath: `/events/${encodeURIComponent(event.slug ?? event.id)}` };
  }

  // Only the owner is shown their real name: a public profile shows its handle.
  const athleteLabel = isOwner
    ? entry.athleteName.trim() || account.name?.trim() || account.username || "You"
    : account.username!;

  return {
    kind: "ok",
    summary: {
      registrationId: entry.id,
      isOwner,
      username: account.username,
      athleteLabel,
      resultTime: entry.resultTime,
      resultPlacement: entry.resultPlacement,
      resultDistance: entry.resultDistance,
      isPersonalBest: entry.isPersonalBest,
      isTopResult: entry.isTopResult,
      wave: entry.startWaveLabel ?? entry.waveLabel,
      // The public profile shows a time and a placing, nothing more. A bib and
      // a team name (often teammates' names) are for the athlete themselves.
      bibNumber: isOwner ? (entry.team?.bibNumber ?? entry.bibNumber) : null,
      teamName: isOwner ? (entry.team?.name ?? null) : null,
      event,
    },
  };
}
