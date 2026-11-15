/**
 * Where an event is, as one line. The venue name is optional and a pending
 * listing can still be missing its city, so every part may be blank. Gluing
 * the parts with a fixed ", " showed ", Melbourne VIC" and ", VIC" on those
 * events (#530); these skip whatever is empty instead.
 */

const clean = (value: string | null | undefined) => value?.trim() || "";

/** `Olympic Park, Melbourne VIC`, skipping whatever is blank. */
export function formatEventPlace(place: {
  venue?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const area = [clean(place.city), clean(place.state).toUpperCase()].filter(Boolean).join(" ");
  return [clean(place.venue), area].filter(Boolean).join(", ");
}

/**
 * `Melbourne, VIC` (or `Melbourne, Victoria` when given the state's label),
 * skipping whatever is blank.
 */
export function formatEventArea(city: string | null | undefined, state: string | null | undefined): string {
  return [clean(city), clean(state)].filter(Boolean).join(", ");
}
