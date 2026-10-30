import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAllEvents, getPublicEventsByIds } from "@/lib/events";
import {
  buildEventListPage,
  EVENT_PAGE_SIZE,
  MAX_EVENT_PAGE_SIZE,
  type EventListRequest,
} from "@/lib/event-listing";
import type {
  AustralianState,
  CompetitionFormat,
  EventType,
  ExperienceLevel,
  FilterState,
  SortOption,
} from "@/types";

export const dynamic = "force-dynamic";

const EVENT_TYPES: readonly EventType[] = [
  "crossfit", "running", "hybrid", "swimming", "cycling", "triathlon",
];
const AUSTRALIAN_STATES: readonly AustralianState[] = [
  "nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt",
];
const COMPETITION_FORMATS: readonly CompetitionFormat[] = ["individual", "team", "both"];
const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = ["open", "beginner", "elite"];
const SORT_OPTIONS: readonly SortOption[] = ["date", "price-asc", "price-desc", "popular"];

const optionalNumber = (min: number, max?: number) =>
  z.preprocess(
    (value) => {
      if (value === "" || value == null) return undefined;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return undefined;
      if (parsed < min || (max != null && parsed > max)) return undefined;
      return parsed;
    },
    z.number().optional(),
  );

const listQuery = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).catch(EVENT_PAGE_SIZE),
  q: z.string().trim().max(200).catch(""),
  where: z.string().trim().max(100).catch(""),
  division: z.string().trim().max(100).optional(),
  dateRange: z.enum(["this-month", "next-3", "all"]).catch("all"),
  sort: z.enum(["date", "price-asc", "price-desc", "popular"]).catch("date"),
  minPrice: optionalNumber(0),
  maxPrice: optionalNumber(0),
  originLat: optionalNumber(-90, 90),
  originLng: optionalNumber(-180, 180),
});

/** Repeated (?type=a&type=b) or comma-separated (?type=a,b) values. */
function listParam(searchParams: URLSearchParams, key: string): string[] {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function enumList<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const allowedSet = new Set<string>(allowed);
  return values.filter((value): value is T => allowedSet.has(value));
}

/**
 * Public events listing.
 *
 * Filters and sorting are applied before pagination, so a match on a later page
 * is never missed and "load more" appends in the same order. One response is
 * capped at MAX_EVENT_PAGE_SIZE events; suggestions and otherEvents are
 * separate, smaller lists.
 *
 * `ids` is for callers that need a specific handful of events (the activity
 * page's saved and registered tabs) rather than the catalogue.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parsed = listQuery.parse(Object.fromEntries(searchParams));

  const ids = listParam(searchParams, "ids").slice(0, MAX_EVENT_PAGE_SIZE);
  if (ids.length > 0) {
    const events = await getPublicEventsByIds(ids);
    const response = NextResponse.json({
      events,
      total: events.length,
      page: 1,
      pageSize: events.length,
      hasMore: false,
      suggestions: [],
      otherEvents: [],
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const pageSize = Math.min(parsed.limit, MAX_EVENT_PAGE_SIZE);
  const sort = enumList([parsed.sort], SORT_OPTIONS)[0] ?? "date";
  const origin =
    parsed.originLat != null && parsed.originLng != null
      ? { lat: parsed.originLat, lng: parsed.originLng }
      : null;

  const filters: FilterState = {
    types: enumList([...listParam(searchParams, "type"), ...listParam(searchParams, "types")], EVENT_TYPES),
    states: enumList([...listParam(searchParams, "state"), ...listParam(searchParams, "states")], AUSTRALIAN_STATES),
    formats: enumList([...listParam(searchParams, "format"), ...listParam(searchParams, "formats")], COMPETITION_FORMATS),
    levels: enumList([...listParam(searchParams, "level"), ...listParam(searchParams, "levels")], EXPERIENCE_LEVELS),
    priceRange:
      parsed.minPrice != null && parsed.maxPrice != null
        ? [parsed.minPrice, parsed.maxPrice]
        : null,
    dateRange: parsed.dateRange,
    // A division picked from the search dropdown is the keyword. The field's
    // readable label ("Running - 10km") is not a search term.
    searchQuery: parsed.division ?? parsed.q,
    originLat: origin?.lat,
    originLng: origin?.lng,
  };

  const events = await getAllEvents();
  const request: EventListRequest = {
    page: parsed.page,
    pageSize,
    filters,
    sort,
    where: parsed.where,
    origin,
  };
  const response = NextResponse.json(buildEventListPage(events, request));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
