import { createClient } from "@supabase/supabase-js";
import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Lazy singleton — only created when valid env vars are present
let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!_client) _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

// Keep named export for direct use in API routes
export const supabase = {
  from: (table: string) => {
    const client = getClient();
    if (!client) throw new Error("Supabase not configured");
    return client.from(table);
  },
};

type Row = Record<string, unknown>;

export function rowToEvent(row: Row): FitnessEvent {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    date: row.date as string,
    time: row.time as string,
    endTime: (row.end_time as string) || undefined,
    location: row.location as string,
    city: row.city as string,
    state: row.state as FitnessEvent["state"],
    type: row.type as FitnessEvent["type"],
    format: row.format as FitnessEvent["format"],
    level: row.level as FitnessEvent["level"],
    image: (row.image as string) || "",
    registrationUrl: row.registration_url as string,
    organizer: (row.organizer as string) || undefined,
    distance: (row.distance as string) || undefined,
    isOfficial: Boolean(row.is_official),
  };
}

export function eventToRow(event: Partial<FitnessEvent>): Row {
  const row: Row = {};
  if (event.id !== undefined) row.id = event.id;
  if (event.title !== undefined) row.title = event.title;
  if (event.description !== undefined) row.description = event.description;
  if (event.date !== undefined) row.date = event.date;
  if (event.time !== undefined) row.time = event.time;
  row.end_time = event.endTime || null;
  if (event.location !== undefined) row.location = event.location;
  if (event.city !== undefined) row.city = event.city;
  if (event.state !== undefined) row.state = event.state;
  if (event.type !== undefined) row.type = event.type;
  if (event.format !== undefined) row.format = event.format;
  if (event.level !== undefined) row.level = event.level;
  row.image = event.image ?? "";
  if (event.registrationUrl !== undefined) row.registration_url = event.registrationUrl;
  row.organizer = event.organizer || null;
  row.distance = event.distance || null;
  row.is_official = event.isOfficial ?? false;
  return row;
}

/**
 * Merge the static JSON catalog with Supabase rows so catalog-only events
 * still appear once the DB has other rows (saved/profile lists need every id).
 */
export function mergeCatalogWithDbRows(
  dbRows: Record<string, unknown>[]
): FitnessEvent[] {
  const jsonEvents = eventsData.events as FitnessEvent[];
  const byId = new Map<string, FitnessEvent>();

  for (const j of jsonEvents) {
    byId.set(String(j.id), j);
  }

  for (const row of dbRows) {
    const live = rowToEvent(row);
    const id = String(live.id);
    const json = byId.get(id);
    byId.set(id, json ? { ...json, ...live } : live);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export async function fetchAllEvents(): Promise<FitnessEvent[]> {
  const fallback = eventsData.events as FitnessEvent[];
  if (!supabaseUrl || !supabaseAnonKey) return fallback;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );
    const query = getClient()!
      .from("events")
      .select("*")
      .or("status.eq.approved,status.is.null")
      .order("date", { ascending: true });
    const { data, error } = await Promise.race([query, timeout]) as Awaited<typeof query>;
    if (error || !data?.length) return fallback;
    return mergeCatalogWithDbRows(data as Record<string, unknown>[]);
  } catch {
    return fallback;
  }
}
