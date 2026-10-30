import type { UserEvent } from "@/types";
import { getEventCoords } from "@/lib/australia-coords";

/** Resolve event coordinates from DB values, falling back to city/state lookup. */
export function eventLngLat(event: UserEvent): { lat: number; lng: number } | null {
  const rawLat = event.latitude as unknown;
  const rawLng = event.longitude as unknown;
  if (rawLat != null && rawLng != null && rawLat !== "" && rawLng !== "") {
    const lat = typeof rawLat === "number" ? rawLat : Number(rawLat);
    const lng = typeof rawLng === "number" ? rawLng : Number(rawLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  if (event.city && event.state) {
    const [lat, lng] = getEventCoords(event.city, event.state);
    return { lat, lng };
  }

  return null;
}

export function hasCoordinates(event: UserEvent): boolean {
  return eventLngLat(event) !== null;
}

export function filterMapEvents(events: UserEvent[]): UserEvent[] {
  return events.filter(hasCoordinates);
}

/**
 * The selection a map click leaves behind. EventMap reports a click on empty
 * map as "", and only the selected pin draws the expanded card with its More
 * Info and Register buttons, so this is what decides whether that card is open
 * (#338).
 *
 * Tapping the open pin again closes it, which is what makes a pin a toggle
 * rather than a one-way trip.
 */
export function nextMapSelection(previous: string | null, clicked: string): string | null {
  if (!clicked) return null;
  return previous === clicked ? null : clicked;
}
