import type { EventStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { publicDiscoveryWhere } from "@/lib/event-lifecycle";
import { getOrganiserRatings } from "@/lib/reviews";
import { lowestPrice, normaliseInformationPdfs, type PublicEvent, type PublicWave } from "./event-types";

export async function getAllEvents() {
  try {
    const events = await prisma.event.findMany({
      where: publicDiscoveryWhere(),
      orderBy: { eventDate: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        discipline: true,
        description: true,
        eventDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        status: true,
        timeZone: true,
        startsAtUtc: true,
        endsAtUtc: true,
        venue: true,
        address: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        format: true,
        level: true,
        categories: true,
        cap: true,
        minAge: true,
        waves: true,
        extras: true,
        refundPolicy: true,
        refundTiers: true,
        coverImageUrl: true,
        photos: true,
        registrationType: true,
        registrationUrl: true,
        feeStructure: true,
        organiserId: true,
        organiser: {
          select: { id: true, orgName: true, logoUrl: true, stripeAccountId: true, stripeOnboardingComplete: true },
        },
        _count: {
          select: { registrations: true },
        },
      },
    });

    const ratings = await getOrganiserRatings(events.map((e) => e.organiserId));

    // `any` avoids a Prisma type dependency; `pnpm build` verifies correctness.
    return events.map((e: any) => ({
      ...e,
      fromPrice: lowestPrice(e.waves),
      registrationCount: e._count.registrations,
      organiser: e.organiser
        ? { ...e.organiser, rating: ratings.get(e.organiserId) ?? null }
        : e.organiser,
    }));
  } catch {
    return [];
  }
}

const publicEventSelect = {
  id: true,
  slug: true,
  title: true,
  discipline: true,
  description: true,
  eventDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  status: true,
  timeZone: true,
  startsAtUtc: true,
  endsAtUtc: true,
  venue: true,
  address: true,
  city: true,
  state: true,
  latitude: true,
  longitude: true,
  format: true,
  level: true,
  categories: true,
  cap: true,
  minAge: true,
  waves: true,
  extras: true,
  refundPolicy: true,
  refundTiers: true,
  coverImageUrl: true,
  photos: true,
  informationPdfs: true,
  registrationType: true,
  registrationUrl: true,
  feeStructure: true,
  organiserId: true,
  organiser: {
    select: { id: true, orgName: true, logoUrl: true, stripeAccountId: true, stripeOnboardingComplete: true },
  },
  _count: {
    select: { registrations: true },
  },
} as const;

/**
 * Public events by id, for surfaces that need a specific handful (the saved and
 * registered tabs) rather than the event catalogue. Bounded by the caller so a
 * request cannot turn into a catalogue download again.
 */
export async function getPublicEventsByIds(ids: string[]): Promise<PublicEvent[]> {
  if (ids.length === 0) return [];

  try {
    const events = await prisma.event.findMany({
      where: {
        id: { in: ids },
        status: { in: ["APPROVED", "IN_PROGRESS", "ARCHIVED"] as EventStatus[] },
      },
      orderBy: { eventDate: "asc" },
      select: publicEventSelect,
    });

    const ratings = await getOrganiserRatings(events.map((e) => e.organiserId));
    return events.map((e) => ({
      ...e,
      informationPdfs: normaliseInformationPdfs(e.informationPdfs),
      fromPrice: lowestPrice(e.waves),
      registrationCount: e._count.registrations,
      organiser: e.organiser
        ? { ...e.organiser, rating: ratings.get(e.organiserId) ?? null }
        : e.organiser,
    })) as PublicEvent[];
  } catch {
    return [];
  }
}

/** Single public event by id or slug — live or archived (past) listings. */
export async function getPublicEventById(id: string): Promise<PublicEvent | null> {
  return findEventById(id, { publicOnly: true });
}

/**
 * The same shape at any status, for the admin preview (issue #321). Never
 * call this from anything an athlete can reach: pending, rejected and draft
 * listings are not public.
 */
export async function getEventByIdForAdmin(id: string): Promise<PublicEvent | null> {
  return findEventById(id, { publicOnly: false });
}

async function findEventById(
  id: string,
  { publicOnly }: { publicOnly: boolean },
): Promise<PublicEvent | null> {
  try {
    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        ...(publicOnly
          ? { status: { in: ["APPROVED", "IN_PROGRESS", "ARCHIVED"] as EventStatus[] } }
          : {}),
      },
      select: publicEventSelect,
    });
    if (!event) return null;

    const ratings = await getOrganiserRatings([event.organiserId]);
    return {
      ...event,
      informationPdfs: normaliseInformationPdfs(event.informationPdfs),
      fromPrice: lowestPrice(event.waves),
      registrationCount: event._count.registrations,
      organiser: event.organiser
        ? { ...event.organiser, rating: ratings.get(event.organiserId) ?? null }
        : event.organiser,
    } as PublicEvent;
  } catch {
    return null;
  }
}

/** Archived (past) events for an organiser profile carousel — most recent first. */
export async function getOrganiserPastEvents(organiserId: string, limit = 20): Promise<PublicEvent[]> {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const events = await prisma.event.findMany({
      where: {
        organiserId,
        OR: [
          { status: "ARCHIVED" },
          { status: { in: ["APPROVED", "IN_PROGRESS"] }, endsAtUtc: { lte: now } },
          // Rows created before the UTC columns existed still fall back to the
          // local date fields until the next write fills them.
          {
            status: "APPROVED",
            endsAtUtc: null,
            OR: [
              { endDate: { not: null, lt: today } },
              { endDate: null, eventDate: { lt: today } },
            ],
          },
        ],
      },
      orderBy: { eventDate: "desc" },
      take: limit,
      select: publicEventSelect,
    });

    const ratings = await getOrganiserRatings([organiserId]);
    const rating = ratings.get(organiserId) ?? null;

    return events.map((e: any) => ({
      ...e,
      fromPrice: lowestPrice(e.waves),
      registrationCount: e._count.registrations,
      organiser: e.organiser
        ? { ...e.organiser, rating }
        : e.organiser,
    }));
  } catch {
    return [];
  }
}
