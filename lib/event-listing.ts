import type { FilterState, SortOption, UserEvent } from "@/types";
import type { PublicEvent } from "@/lib/event-types";
import { toUserEvents } from "@/lib/user-events";
import { eventDistance } from "@/lib/distance";
import { filterEvents, sortEvents, sortEventsByDate } from "@/lib/utils";

/** Default page size for the public events listing. */
export const EVENT_PAGE_SIZE = 20;

/** Hard cap on the number of events the listing API will return in one page. */
export const MAX_EVENT_PAGE_SIZE = 50;

/** "Other events you may like" shown under a set of results. */
export const OTHER_EVENTS_LIMIT = 6;

/**
 * The empty-search fallback. The previous page listed every upcoming event when
 * a search matched nothing; the API now sends one page of them instead.
 */
export const SUGGESTION_LIMIT = EVENT_PAGE_SIZE;

export const NO_EVENT_FILTERS: FilterState = {
  types: [],
  states: [],
  formats: [],
  levels: [],
  priceRange: null,
  dateRange: "all",
  searchQuery: "",
};

export interface EventListRequest {
  page?: number;
  pageSize?: number;
  filters: FilterState;
  sort?: SortOption;
  /** Free-text location typed into the Where field before it is geocoded. */
  where?: string;
  /** Geocoded search origin. When present, results rank closest-first. */
  origin?: { lat: number; lng: number } | null;
}

export interface EventListPage {
  events: PublicEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** First page of upcoming events, only when the current search matched none. */
  suggestions: PublicEvent[];
  /** Up to OTHER_EVENTS_LIMIT alternatives outside the current result set. */
  otherEvents: PublicEvent[];
}

/**
 * Rank events closest-first. A missing coordinate sorts last rather than
 * disappearing; this matches the listing's previous distance ranking.
 */
function sortClosest(events: UserEvent[], origin: { lat: number; lng: number }): UserEvent[] {
  return [...events].sort((a, b) => {
    const da = eventDistance(origin, a) ?? Infinity;
    const db = eventDistance(origin, b) ?? Infinity;
    return da - db || a.id.localeCompare(b.id);
  });
}

/**
 * Apply the events page's filters, sort and pagination to one public-event
 * catalogue snapshot.
 *
 * This deliberately reuses the same pure helpers the page used before #345 so
 * server and client keep the same behaviour. The response is capped at
 * MAX_EVENT_PAGE_SIZE; suggestions and otherEvents are separate, smaller lists.
 */
export function buildEventListPage(
  rawEvents: PublicEvent[],
  request: EventListRequest,
): EventListPage {
  const pageSize = Math.max(
    1,
    Math.min(MAX_EVENT_PAGE_SIZE, Math.trunc(request.pageSize ?? EVENT_PAGE_SIZE)),
  );
  const page = Math.max(1, Math.trunc(request.page ?? 1));
  const sort = request.sort ?? "date";
  const origin = request.origin ?? null;
  const events = toUserEvents(rawEvents);
  const byId = new Map(rawEvents.map((event) => [event.id, event]));

  // A geocoded search deliberately drops the hard radius. The result is ranked
  // closest-first instead, so a suburb with no nearby event still shows the
  // nearest matches rather than an empty list.
  const effectiveFilter: FilterState = origin
    ? { ...request.filters, maxDistance: undefined }
    : request.filters;

  let results = filterEvents(events, effectiveFilter);

  if (origin) {
    results = sortClosest(results, origin);
  } else {
    results = sortEvents(results, sort);
    const where = request.where?.trim().toLowerCase();
    if (where) {
      results = results.filter((event) =>
        event.city.toLowerCase().includes(where) ||
        event.state.toLowerCase().includes(where) ||
        event.location.toLowerCase().includes(where),
      );
    }
  }

  const total = results.length;
  const start = (page - 1) * pageSize;
  const pageEvents = results.slice(start, start + pageSize);
  const hasMore = start + pageEvents.length < total;

  const upcoming = sortEventsByDate(filterEvents(events, NO_EVENT_FILTERS));
  const shown = new Set(results.map((event) => event.id));

  let suggestions: UserEvent[] = [];
  let otherEvents: UserEvent[] = [];

  if (total === 0) {
    suggestions = upcoming.slice(0, SUGGESTION_LIMIT);
  } else {
    const types = new Set(results.map((event) => event.type));
    const cities = new Set(results.map((event) => event.city.toLowerCase()));
    const affinity = (event: UserEvent) =>
      (types.has(event.type) ? 2 : 0) + (cities.has(event.city.toLowerCase()) ? 1 : 0);

    const rest = upcoming.filter((event) => !shown.has(event.id));
    otherEvents = [...rest]
      .sort((a, b) =>
        affinity(b) - affinity(a) ||
        a.date.localeCompare(b.date) ||
        a.id.localeCompare(b.id))
      .slice(0, OTHER_EVENTS_LIMIT);
  }

  const toRaw = (list: UserEvent[]) =>
    list.flatMap((event) => {
      const raw = byId.get(event.id);
      return raw ? [raw] : [];
    });

  return {
    events: toRaw(pageEvents),
    total,
    page,
    pageSize,
    hasMore,
    suggestions: toRaw(suggestions),
    otherEvents: toRaw(otherEvents),
  };
}
