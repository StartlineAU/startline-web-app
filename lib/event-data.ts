import type { Prisma } from "@prisma/client";
import type { EventStatus } from "@prisma/client";

export interface EventBasicsPayload {
  title: string;
  tagline?: string | null;
  description?: string | null;
}

export interface EventSchedulePayload {
  eventDate: string;
  endDate?: string | null;
  startTime: string;
  endTime?: string | null;
  venue: string;
  address?: string | null;
  city: string;
  state: string;
}

export interface EventFormatPayload {
  discipline: string;
  format: string;
  level: string;
  categories?: unknown;
  cap?: number | null;
  minAge?: number;
}

export interface EventTicketsPayload {
  waves?: unknown;
  inclusions?: string | null;
  extras?: string | null;
  activations?: string | null;
  refundPolicy?: string | null;
  registrationType?: string;
  feeStructure?: string;
  registrationUrl?: string | null;
}

export interface EventDetailsPayload {
  coverImageUrl?: string | null;
  bagDrop?: string | null;
  parking?: string | null;
  accessibilityInfo?: string | null;
  additionalNotes?: string | null;
}

export interface EventWritePayload {
  basics?: EventBasicsPayload | null;
  schedule?: EventSchedulePayload | null;
  format?: EventFormatPayload | null;
  tickets?: EventTicketsPayload | null;
  details?: EventDetailsPayload | null;
}

export interface EventResponse {
  id: string;
  organiserId: string;
  status: EventStatus;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  adminReview: {
    adminNotes: string | null;
    rejectionReason: string | null;
    reviewedAt: string | null;
    reviewedBy: { id: string; email: string; name: string | null } | null;
  } | null;
  basics: {
    title: string;
    tagline: string | null;
    description: string | null;
  } | null;
  schedule: {
    eventDate: string;
    endDate: string | null;
    startTime: string;
    endTime: string | null;
    venue: string;
    address: string | null;
    city: string;
    state: string;
  } | null;
  format: {
    discipline: string;
    format: string;
    level: string;
    categories: string[];
    cap: number | null;
    minAge: number;
  } | null;
  tickets: {
    waves: EventWaveResponse[];
    inclusions: string | null;
    extras: string | null;
    activations: string | null;
    refundPolicy: string | null;
    registrationType: string;
    feeStructure: string;
    registrationUrl: string | null;
  } | null;
  details: {
    coverImageUrl: string | null;
    bagDrop: string | null;
    parking: string | null;
    accessibilityInfo: string | null;
    additionalNotes: string | null;
  } | null;
  organiser?: {
    id: string;
    orgName: string | null;
    contactName: string | null;
    email: string;
    logoUrl?: string | null;
    stripeAccountId?: string | null;
    stripeOnboardingComplete?: boolean;
  };
  registrations?: unknown[];
  announcements?: unknown[];
  reviews?: unknown[];
  registrationCount?: number;
}

export interface EventWaveResponse {
  label: string;
  price: string;
  closes?: string;
  date?: string;
  qty?: number;
}

type EventWithRelations = Prisma.EventGetPayload<{
  include: typeof eventInclude.full;
}>;

type EventListingRow = Prisma.EventGetPayload<{
  include: typeof eventInclude.listing;
}>;

const adminReviewInclude = {
  reviewedBy: { select: { id: true, email: true, name: true } },
} as const;

const formatInclude = {
  include: { categories: { orderBy: { sortOrder: "asc" as const } } },
} as const;

const ticketsInclude = {
  include: { waves: { orderBy: { sortOrder: "asc" as const } } },
} as const;

export const eventInclude = {
  full: {
    basics: true,
    schedule: true,
    format: formatInclude,
    tickets: ticketsInclude,
    details: true,
    adminReview: { include: adminReviewInclude },
  },
  listing: {
    basics: true,
    schedule: true,
    format: formatInclude,
    tickets: ticketsInclude,
    details: true,
    adminReview: { include: adminReviewInclude },
    _count: { select: { registrations: true } },
  },
  checkout: {
    basics: true,
    tickets: ticketsInclude,
    organiser: {
      select: {
        id: true,
        stripeAccountId: true,
        stripeOnboardingComplete: true,
      },
    },
  },
  admin: {
    basics: true,
    schedule: true,
    format: formatInclude,
    details: true,
    adminReview: { include: adminReviewInclude },
    organiser: {
      select: {
        id: true,
        orgName: true,
        contactName: true,
        email: true,
      },
    },
  },
  public: {
    basics: true,
    schedule: true,
    format: formatInclude,
    tickets: ticketsInclude,
    details: true,
    organiser: {
      select: {
        id: true,
        orgName: true,
        logoUrl: true,
        stripeAccountId: true,
        stripeOnboardingComplete: true,
      },
    },
  },
} as const;

export function validateEventPayload(payload: EventWritePayload, submit: boolean): string | null {
  if (!submit) {
    if (!payload.basics?.title?.trim()) {
      return "A title is required to save a draft.";
    }
    return null;
  }

  const required: [string, unknown][] = [
    ["basics.title", payload.basics?.title],
    ["format.discipline", payload.format?.discipline],
    ["schedule.eventDate", payload.schedule?.eventDate],
    ["schedule.startTime", payload.schedule?.startTime],
    ["schedule.venue", payload.schedule?.venue],
    ["schedule.city", payload.schedule?.city],
    ["schedule.state", payload.schedule?.state],
    ["format.format", payload.format?.format],
    ["format.level", payload.format?.level],
  ];

  for (const [field, value] of required) {
    if (!value) return `${field} is required.`;
  }

  if (payload.tickets?.registrationType === "external" && !payload.tickets?.registrationUrl) {
    return "tickets.registrationUrl is required for external registrations.";
  }

  return null;
}

function basicsFromPayload(basics: EventBasicsPayload) {
  return {
    title: basics.title,
    tagline: basics.tagline ?? null,
    description: basics.description ?? null,
  };
}

function scheduleFromPayload(schedule: EventSchedulePayload) {
  return {
    eventDate: schedule.eventDate,
    endDate: schedule.endDate ?? null,
    startTime: schedule.startTime,
    endTime: schedule.endTime || null,
    venue: schedule.venue,
    address: schedule.address ?? null,
    city: schedule.city,
    state: schedule.state,
  };
}

function formatScalarsFromPayload(format: EventFormatPayload) {
  return {
    discipline: format.discipline,
    format: format.format,
    level: format.level,
    cap: format.cap ?? null,
    minAge: format.minAge ?? 16,
  };
}

type WaveInput = { label: string; price: string; closes?: string; date?: string; qty?: number };

function parsePriceCents(price: string | number | undefined): number {
  const n = typeof price === "number" ? price : parseFloat(price ?? "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function parseClosesAt(wave: WaveInput): Date | null {
  const raw = wave.closes?.trim() || wave.date?.trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function categoriesFromPayload(categories: unknown) {
  if (!Array.isArray(categories)) return [];
  return categories.map((name, sortOrder) => ({
    name: String(name),
    sortOrder,
    isCustom: false,
  }));
}

function wavesFromPayload(waves: unknown) {
  if (!Array.isArray(waves)) return [];
  return waves
    .filter((w) => Boolean((w as WaveInput).label?.trim()))
    .map((w, sortOrder) => {
      const wave = w as WaveInput;
      return {
        label: wave.label.trim(),
        priceCents: parsePriceCents(wave.price),
        closesAt: parseClosesAt(wave),
        capacity: wave.qty ?? null,
        sortOrder,
      };
    });
}

function centsToPriceString(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

function closesAtToString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapCategoriesToResponse(
  categories: { name: string; sortOrder: number }[] | undefined,
): string[] {
  if (!categories?.length) return [];
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => c.name);
}

function mapWavesToResponse(
  waves: {
    label: string;
    priceCents: number;
    closesAt: Date | null;
    capacity: number | null;
    sortOrder: number;
  }[] | undefined,
): EventWaveResponse[] {
  if (!waves?.length) return [];
  return [...waves]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((w) => {
      const closes = w.closesAt ? closesAtToString(w.closesAt) : undefined;
      return {
        label: w.label,
        price: centsToPriceString(w.priceCents),
        ...(closes ? { closes, date: closes } : {}),
        ...(w.capacity != null ? { qty: w.capacity } : {}),
      };
    });
}

function ticketsScalarsFromPayload(tickets: EventTicketsPayload) {
  return {
    inclusions: tickets.inclusions ?? null,
    extras: tickets.extras ?? null,
    activations: tickets.activations ?? null,
    refundPolicy: tickets.refundPolicy ?? null,
    registrationType: tickets.registrationType ?? "startline",
    feeStructure: tickets.feeStructure ?? "athlete",
    registrationUrl: tickets.registrationUrl ?? null,
  };
}

function detailsFromPayload(details: EventDetailsPayload) {
  return {
    coverImageUrl: details.coverImageUrl ?? null,
    bagDrop: details.bagDrop ?? null,
    parking: details.parking ?? null,
    accessibilityInfo: details.accessibilityInfo ?? null,
    additionalNotes: details.additionalNotes ?? null,
  };
}

export function buildEventCreateData(
  organiserId: string,
  status: EventStatus,
  payload: EventWritePayload,
): Prisma.EventCreateInput {
  const data: Prisma.EventCreateInput = {
    organiser: { connect: { id: organiserId } },
    status,
  };

  if (payload.basics) {
    data.basics = { create: basicsFromPayload(payload.basics) };
  }
  if (payload.schedule) {
    data.schedule = { create: scheduleFromPayload(payload.schedule) };
  }
  if (payload.format) {
    const categories = categoriesFromPayload(payload.format.categories);
    data.format = {
      create: {
        ...formatScalarsFromPayload(payload.format),
        categories: { create: categories },
      },
    };
  }
  if (payload.tickets) {
    const waves = wavesFromPayload(payload.tickets.waves);
    data.tickets = {
      create: {
        ...ticketsScalarsFromPayload(payload.tickets),
        waves: { create: waves },
      },
    };
  }
  if (payload.details) {
    data.details = { create: detailsFromPayload(payload.details) };
  }

  return data;
}

export function buildEventUpdateData(payload: EventWritePayload): Prisma.EventUpdateInput {
  const data: Prisma.EventUpdateInput = {};

  if (payload.basics) {
    data.basics = {
      upsert: {
        create: basicsFromPayload(payload.basics),
        update: basicsFromPayload(payload.basics),
      },
    };
  }
  if (payload.schedule) {
    data.schedule = {
      upsert: {
        create: scheduleFromPayload(payload.schedule),
        update: scheduleFromPayload(payload.schedule),
      },
    };
  }
  if (payload.format) {
    const scalars = formatScalarsFromPayload(payload.format);
    const categories = categoriesFromPayload(payload.format.categories);
    data.format = {
      upsert: {
        create: { ...scalars, categories: { create: categories } },
        update: {
          ...scalars,
          categories: { deleteMany: {}, create: categories },
        },
      },
    };
  }
  if (payload.tickets) {
    const scalars = ticketsScalarsFromPayload(payload.tickets);
    const waves = wavesFromPayload(payload.tickets.waves);
    data.tickets = {
      upsert: {
        create: { ...scalars, waves: { create: waves } },
        update: {
          ...scalars,
          waves: { deleteMany: {}, create: waves },
        },
      },
    };
  }
  if (payload.details) {
    data.details = {
      upsert: {
        create: detailsFromPayload(payload.details),
        update: detailsFromPayload(payload.details),
      },
    };
  }

  return data;
}

export function parseEventWritePayload(body: Record<string, unknown>): EventWritePayload {
  const basics = body.basics as EventBasicsPayload | undefined;
  const schedule = body.schedule as EventSchedulePayload | undefined;
  const format = body.format as EventFormatPayload | undefined;
  const tickets = body.tickets as EventTicketsPayload | undefined;
  const details = body.details as EventDetailsPayload | undefined;

  return { basics, schedule, format, tickets, details };
}

export function toEventResponse(
  event: EventWithRelations | EventListingRow | Record<string, unknown>,
  extras?: { registrationCount?: number },
): EventResponse {
  const e = event as EventWithRelations & { _count?: { registrations: number } };

  return {
    id: e.id,
    organiserId: e.organiserId,
    status: e.status,
    isPinned: e.isPinned,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    adminReview: e.adminReview
      ? {
          adminNotes: e.adminReview.adminNotes,
          rejectionReason: e.adminReview.rejectionReason,
          reviewedAt: e.adminReview.reviewedAt?.toISOString() ?? null,
          reviewedBy: e.adminReview.reviewedBy
            ? {
                id: e.adminReview.reviewedBy.id,
                email: e.adminReview.reviewedBy.email,
                name: e.adminReview.reviewedBy.name,
              }
            : null,
        }
      : null,
    basics: e.basics
      ? {
          title: e.basics.title,
          tagline: e.basics.tagline,
          description: e.basics.description,
        }
      : null,
    schedule: e.schedule
      ? {
          eventDate: e.schedule.eventDate,
          endDate: e.schedule.endDate,
          startTime: e.schedule.startTime,
          endTime: e.schedule.endTime,
          venue: e.schedule.venue,
          address: e.schedule.address,
          city: e.schedule.city,
          state: e.schedule.state,
        }
      : null,
    format: e.format
      ? {
          discipline: e.format.discipline,
          format: e.format.format,
          level: e.format.level,
          categories: mapCategoriesToResponse(
            "categories" in e.format && Array.isArray(e.format.categories)
              ? e.format.categories
              : undefined,
          ),
          cap: e.format.cap,
          minAge: e.format.minAge,
        }
      : null,
    tickets: e.tickets
      ? {
          waves: mapWavesToResponse(
            "waves" in e.tickets && Array.isArray(e.tickets.waves)
              ? e.tickets.waves
              : undefined,
          ),
          inclusions: e.tickets.inclusions,
          extras: e.tickets.extras,
          activations: e.tickets.activations,
          refundPolicy: e.tickets.refundPolicy,
          registrationType: e.tickets.registrationType,
          feeStructure: e.tickets.feeStructure,
          registrationUrl: e.tickets.registrationUrl,
        }
      : null,
    details: e.details
      ? {
          coverImageUrl: e.details.coverImageUrl,
          bagDrop: e.details.bagDrop,
          parking: e.details.parking,
          accessibilityInfo: e.details.accessibilityInfo,
          additionalNotes: e.details.additionalNotes,
        }
      : null,
    ...( "organiser" in e && e.organiser ? { organiser: e.organiser as EventResponse["organiser"] } : {}),
    ...(extras?.registrationCount !== undefined
      ? { registrationCount: extras.registrationCount }
      : e._count
        ? { registrationCount: e._count.registrations }
        : {}),
  };
}

export function getWaves(event: { tickets?: { waves?: unknown } | null }): EventWaveResponse[] {
  const waves = event.tickets?.waves;
  if (!Array.isArray(waves) || waves.length === 0) return [];

  const first = waves[0] as Record<string, unknown>;
  if (typeof first.price === "string") {
    return waves as EventWaveResponse[];
  }

  return mapWavesToResponse(
    waves as {
      label: string;
      priceCents: number;
      closesAt: Date | null;
      capacity: number | null;
      sortOrder: number;
    }[],
  );
}

export function lowestWavePrice(waves: EventWaveResponse[] | unknown): number | null {
  const list = Array.isArray(waves) ? (waves as EventWaveResponse[]) : [];
  const prices = list
    .map((w) => parseFloat(w?.price ?? ""))
    .filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : null;
}

/** Convenience accessors for nested event fields in UI code */
export const ef = {
  title:           (e: EventResponse) => e.basics?.title ?? "",
  tagline:         (e: EventResponse) => e.basics?.tagline ?? null,
  description:     (e: EventResponse) => e.basics?.description ?? null,
  eventDate:       (e: EventResponse) => e.schedule?.eventDate ?? "",
  endDate:         (e: EventResponse) => e.schedule?.endDate ?? null,
  startTime:       (e: EventResponse) => e.schedule?.startTime ?? "",
  endTime:         (e: EventResponse) => e.schedule?.endTime ?? null,
  venue:           (e: EventResponse) => e.schedule?.venue ?? "",
  address:         (e: EventResponse) => e.schedule?.address ?? null,
  city:            (e: EventResponse) => e.schedule?.city ?? "",
  state:           (e: EventResponse) => e.schedule?.state ?? "",
  discipline:      (e: EventResponse) => e.format?.discipline ?? "",
  format:          (e: EventResponse) => e.format?.format ?? "",
  level:           (e: EventResponse) => e.format?.level ?? "",
  categories:      (e: EventResponse) => e.format?.categories ?? [],
  cap:             (e: EventResponse) => e.format?.cap ?? null,
  minAge:          (e: EventResponse) => e.format?.minAge ?? 16,
  waves:           (e: EventResponse) => getWaves(e),
  inclusions:      (e: EventResponse) => e.tickets?.inclusions ?? null,
  registrationType:(e: EventResponse) => e.tickets?.registrationType ?? "startline",
  feeStructure:    (e: EventResponse) => e.tickets?.feeStructure ?? "athlete",
  registrationUrl: (e: EventResponse) => e.tickets?.registrationUrl ?? null,
  coverImageUrl:   (e: EventResponse) => e.details?.coverImageUrl ?? null,
  accessibilityInfo:(e: EventResponse) => e.details?.accessibilityInfo ?? null,
  adminNotes:      (e: EventResponse) => e.adminReview?.adminNotes ?? null,
  rejectionReason: (e: EventResponse) => e.adminReview?.rejectionReason ?? null,
  reviewedAt:      (e: EventResponse) => e.adminReview?.reviewedAt ?? null,
  reviewedBy:      (e: EventResponse) => e.adminReview?.reviewedBy ?? null,
};

/** Flat seed/test input → nested write payload */
export interface FlatEventInput {
  title: string;
  discipline: string;
  tagline?: string;
  description?: string;
  eventDate: string;
  endDate?: string;
  startTime: string;
  endTime?: string;
  venue?: string;
  address?: string;
  city: string;
  state: string;
  format?: string;
  level?: string;
  categories?: unknown;
  cap?: number;
  minAge?: number;
  waves?: unknown;
  inclusions?: string;
  extras?: string;
  activations?: string;
  refundPolicy?: string;
  registrationType?: string;
  feeStructure?: string;
  registrationUrl?: string;
  coverImageUrl?: string;
  bagDrop?: string;
  parking?: string;
  accessibilityInfo?: string;
}

export function flatToEventWritePayload(data: FlatEventInput): EventWritePayload {
  return {
    basics: {
      title: data.title,
      tagline: data.tagline ?? null,
      description: data.description ?? null,
    },
    schedule: {
      eventDate: data.eventDate,
      endDate: data.endDate ?? null,
      startTime: data.startTime,
      endTime: data.endTime ?? null,
      venue: data.venue ?? "",
      address: data.address ?? null,
      city: data.city,
      state: data.state,
    },
    format: {
      discipline: data.discipline,
      format: data.format ?? "individual",
      level: data.level ?? "open",
      categories: data.categories ?? [],
      cap: data.cap ?? null,
      minAge: data.minAge ?? 16,
    },
    tickets: {
      waves: data.waves ?? [],
      inclusions: data.inclusions ?? null,
      extras: data.extras ?? null,
      activations: data.activations ?? null,
      refundPolicy: data.refundPolicy ?? null,
      registrationType: data.registrationType ?? "startline",
      feeStructure: data.feeStructure ?? "athlete",
      registrationUrl: data.registrationUrl ?? null,
    },
    details: {
      coverImageUrl: data.coverImageUrl ?? null,
      bagDrop: data.bagDrop ?? null,
      parking: data.parking ?? null,
      accessibilityInfo: data.accessibilityInfo ?? null,
    },
  };
}

export function eventResponseToWritePayload(event: EventResponse): EventWritePayload {
  return {
    basics: event.basics ?? undefined,
    schedule: event.schedule ?? undefined,
    format: event.format ?? undefined,
    tickets: event.tickets ?? undefined,
    details: event.details ?? undefined,
  };
}

export function mergeEventPayload(
  base: EventWritePayload,
  patch: EventWritePayload,
): EventWritePayload {
  return {
    basics: patch.basics ?? base.basics,
    schedule: patch.schedule ?? base.schedule,
    format: patch.format ?? base.format,
    tickets: patch.tickets ?? base.tickets,
    details: patch.details ?? base.details,
  };
}
