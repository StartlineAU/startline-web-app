import prisma from "@/lib/prisma";

export interface PublicWave {
  label: string;
  date?: string;
  price?: string;
  qty?: number;
}

export interface PublicEvent {
  id: string;
  title: string;
  discipline: string;
  tagline: string | null;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  venue: string;
  city: string;
  state: string;
  format: string;
  level: string;
  categories: unknown;
  coverImageUrl: string | null;
  registrationType: string;
  registrationUrl: string | null;
  fromPrice: number | null;
  organiser: {
    id: string;
    orgName: string | null;
    logoUrl: string | null;
  };
}

function lowestPrice(waves: unknown): number | null {
  if (!Array.isArray(waves)) return null;
  const prices = (waves as PublicWave[])
    .map((w) => parseFloat(w?.price ?? ""))
    .filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Returns all APPROVED (publicly visible) events, ordered by soonest first.
 * Used by the public events feed (`/api/events`).
 */
export async function getAllEvents(): Promise<PublicEvent[]> {
  const events = await prisma.event.findMany({
    where: { status: "APPROVED" },
    orderBy: { eventDate: "asc" },
    select: {
      id: true,
      title: true,
      discipline: true,
      tagline: true,
      description: true,
      eventDate: true,
      endDate: true,
      startTime: true,
      endTime: true,
      venue: true,
      city: true,
      state: true,
      format: true,
      level: true,
      categories: true,
      waves: true,
      coverImageUrl: true,
      registrationType: true,
      registrationUrl: true,
      organiser: {
        select: { id: true, orgName: true, logoUrl: true },
      },
    },
  });

  return events.map(({ waves, ...e }) => ({
    ...e,
    fromPrice: lowestPrice(waves),
  }));
}
