import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  class AutocompleteCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  class GeoPlacesClient {
    send: typeof send;

    constructor() {
      this.send = send;
    }
  }
  return {
    getServerSession: vi.fn(),
    rateLimitPaid: vi.fn(),
    send,
    geocodePlace: vi.fn(),
    lookupAbn: vi.fn(),
    findMany: vi.fn(),
    AutocompleteCommand,
    GeoPlacesClient,
  };
});

vi.mock("@/lib/amplify-server", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitPaid: mocks.rateLimitPaid }));
vi.mock("@/lib/geocode", () => ({ geocodePlace: mocks.geocodePlace }));
vi.mock("@/lib/abn", () => ({ lookupAbn: mocks.lookupAbn }));
vi.mock("@aws-sdk/client-geo-places", () => ({
  GeoPlacesClient: mocks.GeoPlacesClient,
  AutocompleteCommand: mocks.AutocompleteCommand,
}));
vi.mock("@/lib/prisma", () => ({
  default: { event: { findMany: mocks.findMany } },
}));

import { GET as autocomplete } from "@/app/api/places/autocomplete/route";
import { GET as geocode } from "@/app/api/places/geocode/route";
import { GET as abn } from "@/app/api/abn/route";
import { GET as suburbs } from "@/app/api/events/suburbs/route";

const ORIGINAL_ABR_GUID = process.env.ABR_GUID;

const get = (path: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: { "x-forwarded-for": "203.0.113.9" },
  });

const tooMany = () =>
  NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ABR_GUID = "test-guid";
  mocks.getServerSession.mockResolvedValue({ sub: "user-1" });
  mocks.rateLimitPaid.mockResolvedValue(null);
  mocks.send.mockResolvedValue({ ResultItems: [] });
  mocks.geocodePlace.mockResolvedValue({ latitude: -33.8688, longitude: 151.2093 });
  mocks.lookupAbn.mockResolvedValue({ abn: "12345678901" });
  mocks.findMany.mockResolvedValue([
    {
      city: "Sydney",
      state: "nsw",
      venue: "Bondi Beach",
      latitude: -33.8688,
      longitude: 151.2093,
    },
  ]);
});

afterEach(() => {
  if (ORIGINAL_ABR_GUID === undefined) delete process.env.ABR_GUID;
  else process.env.ABR_GUID = ORIGINAL_ABR_GUID;
});

describe("paid address lookups", () => {
  it("requires a session for address autocomplete and checks nothing else", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const res = await autocomplete(get("/api/places/autocomplete?q=George%20St"));

    expect(res.status).toBe(401);
    expect(mocks.rateLimitPaid).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("applies the per-user autocomplete budget before calling AWS", async () => {
    await autocomplete(get("/api/places/autocomplete?q=George%20St"));

    expect(mocks.rateLimitPaid).toHaveBeenCalledWith(expect.anything(), {
      prefix: "places-autocomplete",
      limit: 90,
      windowSeconds: 60,
      identifier: "user-1",
    });
  });

  it("does not call AWS autocomplete when the limiter blocks", async () => {
    mocks.rateLimitPaid.mockResolvedValue(tooMany());

    const res = await autocomplete(get("/api/places/autocomplete?q=George%20St"));

    expect(res.status).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not geocode when the limiter blocks", async () => {
    mocks.rateLimitPaid.mockResolvedValue(tooMany());

    const res = await geocode(get("/api/places/geocode?q=St%20Kilda"));

    expect(res.status).toBe(429);
    expect(mocks.geocodePlace).not.toHaveBeenCalled();
  });

  it("uses the shared route budget for public geocoding", async () => {
    const res = await geocode(get("/api/places/geocode?q=St%20Kilda"));

    expect(res.status).toBe(200);
    expect(mocks.rateLimitPaid).toHaveBeenCalledWith(expect.anything(), {
      prefix: "places-geocode",
      limit: 30,
      windowSeconds: 60,
    });
    expect(mocks.geocodePlace).toHaveBeenCalledWith("St Kilda");
  });

  it("does not call ABR for a signed-out caller", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const res = await abn(get("/api/abn?abn=12345678901"));

    expect(res.status).toBe(401);
    expect(mocks.rateLimitPaid).not.toHaveBeenCalled();
    expect(mocks.lookupAbn).not.toHaveBeenCalled();
  });

  it("applies the per-user ABN budget before calling ABR", async () => {
    const res = await abn(get("/api/abn?abn=12345678901"));

    expect(res.status).toBe(200);
    expect(mocks.rateLimitPaid).toHaveBeenCalledWith(expect.anything(), {
      prefix: "abn-lookup",
      limit: 20,
      windowSeconds: 60,
      identifier: "user-1",
    });
    expect(mocks.lookupAbn).toHaveBeenCalledWith("12345678901");
  });

  it("does not call ABR when the limiter blocks", async () => {
    mocks.rateLimitPaid.mockResolvedValue(tooMany());

    const res = await abn(get("/api/abn?abn=12345678901"));

    expect(res.status).toBe(429);
    expect(mocks.lookupAbn).not.toHaveBeenCalled();
  });

  it("does not geocode an unknown event suburb when the limiter blocks", async () => {
    mocks.rateLimitPaid.mockResolvedValue(tooMany());

    const res = await suburbs(get("/api/events/suburbs?q=St%20Kilda"));

    expect(res.status).toBe(429);
    expect(mocks.geocodePlace).not.toHaveBeenCalled();
  });

  it("does not spend a geocode slot when the event suburb matches a row", async () => {
    const res = await suburbs(get("/api/events/suburbs?q=Syd"));

    expect(res.status).toBe(200);
    expect(mocks.rateLimitPaid).not.toHaveBeenCalled();
    expect(mocks.geocodePlace).not.toHaveBeenCalled();
  });
});
