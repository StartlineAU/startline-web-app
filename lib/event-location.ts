/**
 * What counts as a real event location (#530). A pending listing reached
 * review with a city of spaces, which then showed as ", VIC" everywhere.
 *
 * Two layers:
 * - `locationFieldErrors` is the shape of each field. It runs in the editor
 *   and again on the server, and needs nothing but the text.
 * - `verifyEventLocation` (server only, `lib/event-location-verify.ts`) asks
 *   the geocoder whether the address and city exist, in the state given.
 *   When the geocoder cannot be reached (local dev and CI have no AWS
 *   credentials) it falls back to the shape check rather than blocking
 *   every submit.
 */

export const AUS_STATE_CODES: readonly string[] = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];

export interface LocationFields {
  venue?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export type LocationField = "venue" | "address" | "city" | "state";
export type LocationFieldErrors = Partial<Record<LocationField, string>>;

/** Spaces in a row are one space; leading and trailing ones go. */
export function tidyLocationText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

// Letters in any script (Māori, accented and Indigenous place names), spaces,
// apostrophes, hyphens and full stops: "St Kilda", "O'Connor",
// "Kalgoorlie-Boulder". It starts and ends with a letter (or a closing "."
// as in "Mt."). No digits: no Australian locality has one.
const CITY = /^\p{L}[\p{L}\p{M} '’.-]*[\p{L}\p{M}.]$|^\p{L}$/u;
// A street address adds digits and the usual separators: "Unit 4/12 Smith St".
const ADDRESS_CHARS = /^[\p{L}\p{M}\p{N} '’.,\-/#&()]+$/u;
const LETTER = /\p{L}/u;

/**
 * Field-by-field problems with a location. Empty fields are only an error
 * where `required` asks for them: a draft can be saved half done, but what it
 * holds must still look like a place.
 */
export function locationFieldErrors(
  fields: LocationFields,
  { required = false }: { required?: boolean } = {},
): LocationFieldErrors {
  const errors: LocationFieldErrors = {};
  const venue = tidyLocationText(fields.venue);
  const address = tidyLocationText(fields.address);
  const city = tidyLocationText(fields.city);
  const state = tidyLocationText(fields.state).toLowerCase();

  if (!address) {
    if (required) errors.address = "Add the street address.";
  } else if (address.length < 5 || address.length > 200 || !ADDRESS_CHARS.test(address) || (address.match(/\p{L}/gu)?.length ?? 0) < 2) {
    errors.address = "Enter a real street address, e.g. 1 Aughtie Dr, Albert Park.";
  }

  if (!city) {
    if (required) errors.city = "Add the city or suburb.";
  } else if (city.length < 2 || city.length > 60 || !CITY.test(city)) {
    errors.city = "Enter a real city or suburb, using letters only.";
  }

  if (!state) {
    if (required) errors.state = "Choose the state.";
  } else if (!AUS_STATE_CODES.includes(state)) {
    errors.state = "Choose an Australian state or territory.";
  }

  if (venue && (venue.length > 120 || !LETTER.test(venue))) {
    errors.venue = "The venue name needs to be a name, e.g. Albert Park.";
  }

  return errors;
}

/** The first problem with a location as a sentence, or null. */
export function firstLocationError(fields: LocationFields, options?: { required?: boolean }): string | null {
  const errors = locationFieldErrors(fields, options);
  return errors.address ?? errors.city ?? errors.state ?? errors.venue ?? null;
}
