import type { UserEvent } from "@/types";

/** Resolve event coordinates from API/DB values (numbers or numeric strings). */
export function eventLngLat(event: UserEvent): { lat: number; lng: number } | null {
  const rawLat = event.latitude as unknown;
  const rawLng = event.longitude as unknown;
  if (rawLat == null || rawLng == null || rawLat === "" || rawLng === "") return null;
  const lat = typeof rawLat === "number" ? rawLat : Number(rawLat);
  const lng = typeof rawLng === "number" ? rawLng : Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function hasCoordinates(event: UserEvent): boolean {
  return eventLngLat(event) !== null;
}

export function filterMapEvents(events: UserEvent[]): UserEvent[] {
  return events.filter(hasCoordinates);
}
