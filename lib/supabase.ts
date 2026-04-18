import { createClient, SupabaseClient } from "@supabase/supabase-js";
import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "";
const supabaseAnonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Lazy singleton — only instantiated when env vars are present
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  _client ??= createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

/**
 * Thin wrapper that throws a clear error when Supabase is not configured,
 * rather than silently returning a bad client. Used by API route handlers.
 */
export const supabase = {
  from(table: string) {
    const client = getClient();
    if (!client) throw new Error("Supabase is not configured — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    return client.from(table);
  },
};

// ── Row ↔ FitnessEvent mapping ─────────────────────────────────────────────

type Row = Record<string, unknown>;

/** Maps a raw Supabase DB row to a typed FitnessEvent. */
export function rowToEvent(row: Row): FitnessEvent {
  return {
    id:              row.id              as string,
    title:           row.title           as string,
    description:     row.description     as string,
    date:            row.date            as string,
    time:            row.time            as string,
    endTime:         (row.end_time       as string) || undefined,
    location:        row.location        as string,
    city:            row.city            as string,
    state:           row.state           as FitnessEvent["state"],
    type:            row.type            as FitnessEvent["type"],
    format:          row.format          as FitnessEvent["format"],
    level:           row.level           as FitnessEvent["level"],
    image:           (row.image          as string) || "",
    registrationUrl: row.registration_url as string,
    organizer:       (row.organizer      as string) || undefined,
    distance:        (row.distance       as string) || undefined,
    isOfficial:      Boolean(row.is_official),
  };
}

/** Maps a FitnessEvent (or partial) to a Supabase DB row. */
export function eventToRow(event: Partial<FitnessEvent>): Row {
  const row: Row = {};
  if (event.id          !== undefined) row.id          = event.id;
  if (event.title       !== undefined) row.title       = event.title;
  if (event.description !== undefined) row.description = event.description;
  if (event.date        !== undefined) row.date        = event.date;
  if (event.time        !== undefined) row.time        = event.time;
  if (event.location    !== undefined) row.location    = event.location;
  if (event.city        !== undefined) row.city        = event.city;
  if (event.state       !== undefined) row.state       = event.state;
  if (event.type        !== undefined) row.type        = event.type;
  if (event.format      !== undefined) row.format      = event.format;
  if (event.level       !== undefined) row.level       = event.level;
  if (event.registrationUrl !== undefined) row.registration_url = event.registrationUrl;
  row.end_time   = event.endTime   || null;
  row.image      = event.image     ?? "";
  row.organizer  = event.organizer || null;
  row.distance   = event.distance  || null;
  row.is_official = event.isOfficial ?? false;
  return row;
}

// ── Data fetching ──────────────────────────────────────────────────────────

/**
 * Merges the static JSON event catalog with live Supabase rows.
 * DB rows take precedence; catalog-only events are kept so that saved IDs
 * in localStorage still resolve even before a DB record exists.
 */
export function mergeCatalogWithDbRows(dbRows: Row[]): FitnessEvent[] {
  const catalogEvents = eventsData.events as FitnessEvent[];
  const byId = new Map<string, FitnessEvent>(
    catalogEvents.map((e) => [String(e.id), e])
  );

  for (const row of dbRows) {
    const live = rowToEvent(row);
    const id = String(live.id);
    const catalog = byId.get(id);
    // Merge: catalog provides the rich detail fields, DB overrides the live fields
    byId.set(id, catalog ? { ...catalog, ...live } : live);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Fetches all approved events from Supabase, merged with the static catalog.
 * Falls back to the static catalog if Supabase is unavailable or times out.
 */
export async function fetchAllEvents(): Promise<FitnessEvent[]> {
  const fallback = eventsData.events as FitnessEvent[];
  const client = getClient();
  if (!client) return fallback;

  try {
    const query = client
      .from("events")
      .select("*")
      .or("status.eq.approved,status.is.null")
      .order("date", { ascending: true });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );

    const { data, error } = await Promise.race([query, timeout]) as Awaited<typeof query>;

    if (error || !data?.length) return fallback;
    return mergeCatalogWithDbRows(data as Row[]);
  } catch {
    return fallback;
  }
}
