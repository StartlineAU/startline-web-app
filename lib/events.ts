import prisma from "@/lib/prisma";
import { archivePastEvents } from "@/lib/archive-events";

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
  waves: unknown;
  extras: string | null;
  coverImageUrl: string | null;
  registrationType: string;
  registrationUrl: string | null;
  feeStructure: string;
  fromPrice: number | null;
  organiserId: string;
  organiser: {
    id: string;
    orgName: string | null;
    logoUrl: string | null;
    stripeAccountId: string | null;
    stripeOnboardingComplete: boolean;
  };
}

function lowestPrice(waves: unknown): number | null {
  if (!Array.isArray(waves)) return null;
  const prices = (waves as PublicWave[])
    .map((w) => parseFloat(w?.price ?? ""))
    .filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : null;
}

export async function getAllEvents(): Promise<PublicEvent[]> {
  try {
    await archivePastEvents();
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
        extras: true,
        coverImageUrl: true,
        registrationType: true,
        registrationUrl: true,
        feeStructure: true,
        organiserId: true,
        organiser: {
          select: { id: true, orgName: true, logoUrl: true, stripeAccountId: true, stripeOnboardingComplete: true },
        },
      },
    });

    return events.map((e) => ({
      ...e,
      fromPrice: lowestPrice(e.waves),
    }));
  } catch {
    return [];
  }
}
