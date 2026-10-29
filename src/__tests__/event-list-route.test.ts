import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PublicEvent } from "@/lib/event-types";

vi.mock("@/lib/events", () => ({
  getAllEvents: vi.fn(),
  getPublicEventsByIds: vi.fn(),
}));

import { getAllEvents, getPublicEventsByIds } from "@/lib/events";
import { GET } from "@/app/api/events/route";

const mockedAll = getAllEvents as ReturnType<typeof vi.fn>;
const mockedByIds = getPublicEventsByIds as ReturnType<typeof vi.fn>;

function event(n: number, overrides: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id: `event-${n}`,
    slug: `event-${n}`,
    title: `Event ${n}`,
    discipline: "running",
    description: "A test event",
    eventDate: `2027-01-${String((n % 28) + 1).padStart(2, "0")}`,
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

const call = (query = "") =>
  GET(new NextRequest(`http://localhost:3000/api/events${query ? `?${query}` : ""}`));

describe("GET /api/events", () => {
  beforeEach(() => {
    mockedAll.mockReset();
    mockedByIds.mockReset();
    mockedAll.mockResolvedValue(Array.from({ length: 25 }, (_, i) => event(i + 1)));
  });

  it("returns a bounded page object instead of the whole catalogue", async () => {
    const body = await (await call()).json();

    expect(body.events).toHaveLength(20);
    expect(body.total).toBe(25);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.hasMore).toBe(true);
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(Array.isArray(body.otherEvents)).toBe(true);
  });

  it("caps an oversized limit", async () => {
    mockedAll.mockResolvedValue(Array.from({ length: 60 }, (_, i) => event(i + 1)));

    const body = await (await call("limit=1000")).json();

    expect(body.pageSize).toBe(50);
    expect(body.events).toHaveLength(50);
  });

  it("applies repeatable filters before returning a page", async () => {
    mockedAll.mockResolvedValue([
      event(1, { state: "vic", waves: [{ label: "GA", price: "40" }] }),
      event(2, { state: "nsw", waves: [{ label: "GA", price: "40" }] }),
      event(3, { state: "vic", waves: [{ label: "GA", price: "90" }] }),
    ]);

    const body = await (await call("type=running&state=vic&minPrice=0&maxPrice=50")).json();

    expect(body.total).toBe(1);
    expect(body.events.map((e: { id: string }) => e.id)).toEqual(["event-1"]);
  });

  it("returns a specific set by id without reading the catalogue", async () => {
    mockedByIds.mockResolvedValue([event(7)]);

    const body = await (await call("ids=event-7")).json();

    expect(mockedByIds).toHaveBeenCalledWith(["event-7"]);
    expect(mockedAll).not.toHaveBeenCalled();
    expect(body.events).toHaveLength(1);
    expect(body.hasMore).toBe(false);
  });
});
