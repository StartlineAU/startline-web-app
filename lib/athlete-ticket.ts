import prisma from "@/lib/prisma";
import type { UserSession } from "@/lib/amplify-server";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { getOrganiserRatings, type OrganiserRating } from "@/lib/reviews";
import {
  eventContactSelect, organiserContactSelect, resolveOrganiserContact, type OrganiserContact,
} from "@/lib/organiser-contact";

/** How many of the organiser's announcements the ticket shows, newest first. */
export const TICKET_ANNOUNCEMENT_LIMIT = 3;

export type TicketEntryStatus = "CONFIRMED" | "REFUND_REQUESTED" | "REFUNDED";

export type TicketEntry = {
  id: string;
  athleteName: string;
  status: TicketEntryStatus;
  /** Ticket tier bought at checkout, e.g. "Sprint". */
  ticketLabel: string | null;
  /** Organiser-assigned start wave. Null until the organiser assigns one. */
  waveLabel: string | null;
  /** "HH:mm" in the event's own timezone. */
  waveStartTime: string | null;
  bibNumber: string | null;
  checkedInAt: Date | null;
};

export type TicketAnnouncement = {
  id: string;
  title: string;
  /** Sanitised rich text, safe to render as HTML. */
  bodyHtml: string;
  createdAt: Date;
};

export type AthleteTicket = {
  event: {
    id: string;
    title: string;
    discipline: string;
    status: string;
    eventDate: string;
    endDate: string | null;
    startTime: string;
    endTime: string;
    timeZone: string;
    venue: string;
    address: string | null;
    city: string;
    state: string;
    coverImageUrl: string | null;
    organiser: {
      id: string;
      orgName: string | null;
      logoUrl: string | null;
      /** Published reviews only, as on the event page. Null before the first. */
      rating: OrganiserRating | null;
      /** Only the details the organiser chose to show; null when none. */
      contact: OrganiserContact | null;
    };
  };
  entries: TicketEntry[];
  announcements: TicketAnnouncement[];
};

type EntryRow = {
  id: string;
  athleteName: string;
  status: string;
  waveLabel: string | null;
  startWaveLabel: string | null;
  bibNumber: string | null;
  checkedInAt: Date | null;
  startWave: { label: string; startTime: string | null } | null;
};

/**
 * Shape one registration for the ticket. The StartWave row is the source of
 * truth for the wave; the denormalised label covers entries written before the
 * table existed. A wave without its own start time starts with the event.
 */
export function toTicketEntry(row: EntryRow, eventStartTime: string): TicketEntry {
  const waveLabel = row.startWave?.label ?? row.startWaveLabel ?? null;
  return {
    id: row.id,
    athleteName: row.athleteName,
    status: row.status as TicketEntryStatus,
    ticketLabel: row.waveLabel,
    waveLabel,
    waveStartTime: waveLabel ? row.startWave?.startTime ?? eventStartTime : null,
    bibNumber: row.bibNumber,
    checkedInAt: row.checkedInAt,
  };
}

/**
 * The signed-in athlete's ticket for one event: the event's essentials, every
 * entry they hold for it and the organiser's latest announcements.
 *
 * An entry belongs to the athlete when it is linked to their account or was
 * made with their email, the same rule as GET /api/user/registrations, so the
 * ticket and the Activity card always agree. Null when they hold no entry,
 * which keeps one athlete from reading another's bib and wave.
 */
export async function loadAthleteTicket(
  session: UserSession,
  eventId: string,
): Promise<AthleteTicket | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      discipline: true,
      status: true,
      eventDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      timeZone: true,
      venue: true,
      address: true,
      city: true,
      state: true,
      coverImageUrl: true,
      ...eventContactSelect,
      organiser: { select: { id: true, orgName: true, logoUrl: true, ...organiserContactSelect } },
      registrations: {
        where: {
          status: { in: ["CONFIRMED", "REFUND_REQUESTED", "REFUNDED"] },
          OR: [
            { userId: session.sub },
            { athleteEmail: { equals: session.email, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          athleteName: true,
          status: true,
          waveLabel: true,
          startWaveLabel: true,
          bibNumber: true,
          checkedInAt: true,
          startWave: { select: { label: true, startTime: true } },
        },
      },
      announcements: {
        orderBy: { createdAt: "desc" },
        take: TICKET_ANNOUNCEMENT_LIMIT,
        select: { id: true, title: true, body: true, createdAt: true },
      },
    },
  });

  if (!event || event.registrations.length === 0) return null;

  // The raw contact columns stop here: the ticket carries only what resolves.
  const {
    registrations, announcements, organiser,
    showContactName, showContactEmail, showContactPhone, ...rest
  } = event;
  const ratings = await getOrganiserRatings([organiser.id]);
  return {
    event: {
      ...rest,
      organiser: {
        id: organiser.id,
        orgName: organiser.orgName,
        logoUrl: organiser.logoUrl,
        rating: ratings.get(organiser.id) ?? null,
        contact: resolveOrganiserContact(organiser, { showContactName, showContactEmail, showContactPhone }),
      },
    },
    entries: registrations.map((row) => toTicketEntry(row, event.startTime)),
    // Bodies are sanitised on write; sanitising again on read means a row
    // written before that rule, or by hand, still cannot inject markup.
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      bodyHtml: sanitizeHtml(a.body),
      createdAt: a.createdAt,
    })),
  };
}
