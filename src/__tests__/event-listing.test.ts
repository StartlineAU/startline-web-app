import { describe, expect, it } from "vitest";
import { addDays, format } from "date-fns";
import {
  buildEventListPage,
  EVENT_PAGE_SIZE,
  MAX_EVENT_PAGE_SIZE,
  NO_EVENT_FILTERS,
  OTHER_EVENTS_LIMIT,
  SUGGESTION_LIMIT,
} from "@/lib/event-listing";
import type { PublicEvent } from "@/lib/event-types";
import type { FilterState } from "@/types";

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

function event(
  n: number,
  overrides: Partial<PublicEvent> = {},
): PublicEvent {
  return {
    id: `event-${n}`,
    slug: `event-${n}`,
    title: `Event ${n}`,
    discipline: "running",
    description: "A test event",
    eventDate: day(n + 1),
    endDate: null,
    startTime: "07:00",
    endTime: "12:00",
    venue: "Test Venue",
    address: null,
    city: "Sydney",
    state: "nsw",
    latitude: -33.8688,
    longitude: 151.2093,
    format: "individual",
    level: "open",
    categories: ["10K"],
    cap: null,
    minAge: 18,
    waves: [{ label: "GA", price: "40" }],
    extras: null,
    refundPolicy: null,
    refundTiers: null,
    coverImageUrl: null,
    photos: [],
    registrationType: "startline",
    registrationUrl: null,
    feeStructure: "athlete",
    fromPrice: 40,
    registrationCount: 1,
    organiserId: "org-1",
    organiser: {
      id: "org-1",
      orgName: "Test Organiser",
      logoUrl: null,
      stripeAccountId: null,
      stripeOnboardingComplete: true,
    },
    ...overrides,
  } as PublicEvent;
}

const filters = (overrides: Partial<FilterState> = {}): FilterState => ({
  ...NO_EVENT_FILTERS,
  ...overrides,
});

describe("buildEventListPage", () => {
  it("returns one bounded page and reports the full match count", () => {
    const events = Array.from({ length: 25 }, (_, i) => event(i + 1));

    const first = buildEventListPage(events, { page: 1, pageSize: 10, filters: filters() });
    const second = buildEventListPage(events, { page: 2, pageSize: 10, filters: filters() });
    const third = buildEventListPage(events, { page: 3, pageSize: 10, filters: filters() });

    expect(first.events).toHaveLength(10);
    expect(first.total).toBe(25);
    expect(first.hasMore).toBe(true);
    expect(second.events).toHaveLength(10);
    expect(third.events).toHaveLength(5);
    expect(third.hasMore).toBe(false);
  });

  it("caps an oversized page request", () => {
    const events = Array.from({ length: MAX_EVENT_PAGE_SIZE + 10 }, (_, i) => event(i + 1));

    const page = buildEventListPage(events, { page: 1, pageSize: 1000, filters: filters() });

    expect(page.pageSize).toBe(MAX_EVENT_PAGE_SIZE);
    expect(page.events).toHaveLength(MAX_EVENT_PAGE_SIZE);
  });

  it("filters globally before paginating", () => {
    const events = [
      ...Array.from({ length: 12 }, (_, i) => event(i + 1)),
      ...Array.from({ length: 12 }, (_, i) =>
        event(i + 100, { discipline: "cycling", city: "Melbourne", state: "vic" })),
    ];

    const page = buildEventListPage(events, {
      page: 1,
      pageSize: 5,
      filters: filters({ types: ["running"] }),
    });

    expect(page.total).toBe(12);
    expect(page.events).toHaveLength(5);
    expect(page.events.every((e) => e.discipline === "running")).toBe(true);
  });

  it("ranks a geocoded search closest-first across the whole catalogue", () => {
    const events = [
      event(1, { city: "Perth", state: "wa", latitude: -31.9505, longitude: 115.8605 }),
      event(2, { city: "Melbourne", state: "vic", latitude: -37.8136, longitude: 144.9631 }),
      event(3, { city: "Sydney", state: "nsw", latitude: -33.8688, longitude: 151.2093 }),
    ];

    const page = buildEventListPage(events, {
      page: 1,
      pageSize: 1,
      filters: filters({ originLat: -33.8688, originLng: 151.2093 }),
      origin: { lat: -33.8688, lng: 151.2093 },
    });

    expect(page.total).toBe(3);
    expect(page.events.map((e) => e.city)).toEqual(["Sydney"]);
  });

  it("limits the empty-search fallback to one capped page", () => {
    const events = Array.from({ length: 25 }, (_, i) => event(i + 1));

    const page = buildEventListPage(events, {
      page: 1,
      pageSize: EVENT_PAGE_SIZE,
      filters: filters({ types: ["crossfit"] }),
    });

    expect(page.total).toBe(0);
    expect(page.events).toHaveLength(0);
    expect(page.suggestions).toHaveLength(SUGGESTION_LIMIT);
    expect(page.otherEvents).toHaveLength(0);
  });

  it("keeps other events outside every result, not just the current page", () => {
    const events = [
      event(1, { city: "Sydney" }),
      event(2, { city: "Sydney" }),
      event(3, { city: "Sydney" }),
      event(4, { discipline: "cycling", city: "Melbourne", state: "vic" }),
    ];

    const page = buildEventListPage(events, {
      page: 1,
      pageSize: 1,
      filters: filters({ types: ["running"] }),
    });

    expect(page.total).toBe(3);
    expect(page.events).toHaveLength(1);
    expect(page.otherEvents).toHaveLength(1);
    expect(page.otherEvents[0].id).toBe("event-4");
    expect(page.otherEvents.some((e) => e.discipline === "running")).toBe(false);
  });

  it("caps other events", () => {
    const events = [
      event(1, { discipline: "running" }),
      ...Array.from({ length: OTHER_EVENTS_LIMIT + 4 }, (_, i) =>
        event(i + 10, { discipline: "cycling", city: "Melbourne", state: "vic" })),
    ];

    const page = buildEventListPage(events, {
      page: 1,
      pageSize: 1,
      filters: filters({ types: ["running"] }),
    });

    expect(page.otherEvents).toHaveLength(OTHER_EVENTS_LIMIT);
  });

  it("applies the un-geocoded Where text to city, state and venue", () => {
    const page = buildEventListPage(
      [
        event(1, { city: "Melbourne", state: "vic" }),
        event(2, { city: "Sydney", state: "nsw" }),
      ],
      { filters: filters(), where: "melb" },
    );

    expect(page.total).toBe(1);
    expect(page.events[0].city).toBe("Melbourne");
  });
});
