import { geocodeLookup } from "@/lib/geocode";
import { firstLocationError, tidyLocationText, type LocationFields } from "@/lib/event-location";

const sameText = (a: string, b: string) =>
  a.localeCompare(b, "en-AU", { sensitivity: "base" }) === 0;

/**
 * The location check every event route runs, on the event as it will be once
 * written: on an edit, a field the payload leaves out keeps its `saved` value.
 * A submit is checked against the geocoder; a draft only has to look like a
 * place where it is filled in.
 */
export async function checkEventLocation(
  fields: LocationFields,
  { submit, saved }: { submit?: boolean; saved?: LocationFields } = {},
): Promise<string | null> {
  const pick = (k: keyof LocationFields) => (fields[k] !== undefined ? fields[k] : saved?.[k]);
  const location = { venue: pick("venue"), address: pick("address"), city: pick("city"), state: pick("state") };
  return submit ? verifyEventLocation(location) : firstLocationError(location);
}

/**
 * Whether a location is a real place, for a listing being submitted (#530).
 * Null when it is (or when the geocoder cannot be asked, after the shape
 * check has passed); otherwise the reason, ready to show the organiser.
 *
 * - The shape of every field (`locationFieldErrors`), always.
 * - The city has to geocode to a locality of that name in the state given.
 *   Geocoders answer junk with their nearest guess, so a match on the name is
 *   what proves it, not merely getting a result.
 * - The street address has to geocode to somewhere in that state.
 */
export async function verifyEventLocation(fields: LocationFields): Promise<string | null> {
  const shapeError = firstLocationError(fields, { required: true });
  if (shapeError) return shapeError;

  const address = tidyLocationText(fields.address);
  const city = tidyLocationText(fields.city);
  const state = tidyLocationText(fields.state).toLowerCase();
  const STATE = state.toUpperCase();

  const [cityLookup, addressLookup] = await Promise.all([
    geocodeLookup(`${city}, ${STATE}, Australia`),
    geocodeLookup(`${address}, ${city} ${STATE}`),
  ]);

  // No geocoder at all (local dev, CI, an AWS outage): the shape check above
  // is all that can be done, and refusing every submit would be worse. One
  // call failing does not excuse a miss from the other.
  if (cityLookup.status === "unavailable" && addressLookup.status === "unavailable") return null;

  const cityResult = cityLookup.status === "found" ? cityLookup.result : null;
  const addressResult = addressLookup.status === "found" ? addressLookup.result : null;
  const addressMiss = `We couldn't find that street address in ${STATE}. Pick it from the suggestions as you type.`;
  const cityMiss = `We couldn't find ${city} in ${STATE}. Check the city and state.`;

  // A suburb inside a metro city geocodes as a district of it: St Kilda's
  // locality is Melbourne (#352). Either name counts, from either lookup that
  // actually answered.
  const names = (r: typeof cityResult) =>
    r && r.stateCode === state ? [r.city, r.district].filter(Boolean) : [];
  const cityFound = [...names(cityResult), ...names(addressResult)].some((n) => sameText(n, city));
  if (!cityFound && cityLookup.status !== "unavailable") return cityMiss;
  if (!cityFound && addressLookup.status !== "unavailable") {
    if (!addressResult || addressResult.stateCode !== state) return addressMiss;
    return cityMiss;
  }

  // The city was named. An address lookup that could not be asked is not a
  // miss; one that answered and is not in the state is.
  if (addressLookup.status === "unavailable") return null;
  if (!addressResult || addressResult.stateCode !== state) return addressMiss;

  return null;
}
