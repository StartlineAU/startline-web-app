import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";

/**
 * Returns all events from the bundled static catalog.
 *
 * Previously this branch read events from Supabase (`@/lib/supabase`), which
 * has been removed. This wrapper exists so consumers don't need to know the
 * data source — when a real backend (Prisma, etc.) is wired up, swap the
 * implementation here and every page picks it up for free.
 */
export async function getAllEvents(): Promise<FitnessEvent[]> {
  return eventsData.events as FitnessEvent[];
}
