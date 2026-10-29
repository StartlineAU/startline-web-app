import {
  AutocompleteCommand,
  GeoPlacesClient,
  GeocodeCommand,
  type AutocompleteResultItem,
  type GeocodeResultItem,
} from "@aws-sdk/client-geo-places";

const client = new GeoPlacesClient({ region: "ap-southeast-2" });

export interface GeocodeResult {
  label: string;
  city: string;
  stateCode: string;
  stateName: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

/** One state's match for a place name that exists in more than one state. */
export interface PlaceChoice {
  label: string;
  city: string;
  stateCode: string;
  stateName: string;
}

export interface ResolvedPlace {
  result: GeocodeResult | null;
  choices: PlaceChoice[];
}

const AREA_PLACE_TYPES = new Set(["Locality", "District"]);

const STATE_NAMES: Record<string, string> = {
  nsw: "New South Wales",
  vic: "Victoria",
  qld: "Queensland",
  wa: "Western Australia",
  sa: "South Australia",
  tas: "Tasmania",
  act: "Australian Capital Territory",
  nt: "Northern Territory",
};

const STATE_IN_TEXT = /\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i;

type GeocodeItem = (GeocodeResultItem | AutocompleteResultItem) & { Position?: number[] };

/**
 * Autocomplete omits Address.Region for districts, so "St Kilda, Melbourne,
 * VIC 3182" has no state in the structured fields. Its title and label still
 * name the state.
 */
function stateCodeFor(item: GeocodeItem): string {
  const structured = (item.Address?.Region?.Code ?? "").toLowerCase();
  if (structured) return structured;
  const match = (item.Address?.Label ?? item.Title ?? "").match(STATE_IN_TEXT);
  return match?.[1]?.toLowerCase() ?? "";
}

function toGeocodeResult(item: GeocodeItem): GeocodeResult {
  const stateCode = stateCodeFor(item);
  return {
    label: item.Address?.Label ?? "",
    city: item.Address?.Locality ?? item.Address?.District ?? "",
    stateCode,
    stateName: item.Address?.Region?.Name ?? STATE_NAMES[stateCode] ?? "",
    postalCode: item.Address?.PostalCode ?? "",
    country: item.Address?.Country?.Name ?? "",
    latitude: item.Position?.[1] ?? null,
    longitude: item.Position?.[0] ?? null,
  };
}

function toPlaceChoice(item: GeocodeItem): PlaceChoice | null {
  const label = item.Address?.Label ?? "";
  const stateCode = stateCodeFor(item);
  if (!label || !stateCode) return null;
  return {
    label,
    city: item.Address?.Locality ?? item.Address?.District ?? "",
    stateCode,
    stateName: item.Address?.Region?.Name ?? STATE_NAMES[stateCode] ?? "",
  };
}

/**
 * Resolve free text to one place, or to a choice of states when the name is
 * ambiguous. "St Kilda" exists in QLD, SA and Victoria; taking the first
 * geocoder result silently sent Melbourne users to Queensland (#352).
 *
 * Only area names are treated as ambiguous. A full street address can return
 * several point addresses in different suburbs, and the first is still the
 * right answer there.
 */
export async function resolvePlace(q: string): Promise<ResolvedPlace> {
  const query = q.trim();
  if (!query) return { result: null, choices: [] };

  try {
    const res = await client.send(new GeocodeCommand({
      QueryText: query,
      MaxResults: 6,
      Filter: { IncludeCountries: ["AUS"] },
    }));
    const results = (res.ResultItems ?? []).map(toGeocodeResult);
    const areas = (res.ResultItems ?? [])
      .filter((item) => AREA_PLACE_TYPES.has(item.PlaceType ?? ""))
      .map(toPlaceChoice)
      .filter((choice): choice is PlaceChoice => choice !== null);

    if (areas.length < 2) {
      return { result: results[0] ?? null, choices: [] };
    }

    // Geocode only lists localities here, so it misses suburbs that sit inside
    // a metro city (St Kilda, Melbourne). Autocomplete has those districts.
    let autocompleteAreas: PlaceChoice[] = [];
    try {
      const auto = await client.send(new AutocompleteCommand({
        QueryText: query,
        MaxResults: 10,
        Filter: { IncludeCountries: ["AUS"] },
      }));
      autocompleteAreas = (auto.ResultItems ?? [])
        .filter((item) => AREA_PLACE_TYPES.has(item.PlaceType ?? ""))
        .map(toPlaceChoice)
        .filter((choice): choice is PlaceChoice => choice !== null);
    } catch (err) {
      console.error("[places/resolve] AWS autocomplete fallback failed:", err);
    }

    // One entry per state keeps the prompt to a state/city choice, not a list
    // of every suburb whose name starts with the query.
    const byState = new Map<string, PlaceChoice>();
    for (const choice of [...autocompleteAreas, ...areas]) {
      if (!byState.has(choice.stateCode)) byState.set(choice.stateCode, choice);
    }

    const choices = [...byState.values()].slice(0, 8);
    return choices.length > 1
      ? { result: null, choices }
      : { result: results[0] ?? null, choices: [] };
  } catch (err) {
    console.error("[places/resolve] AWS Location Service lookup failed:", err);
    return { result: null, choices: [] };
  }
}

/**
 * Resolve free text to a place via AWS Location Service.
 *
 * Returns null rather than throwing when the lookup fails or credentials are
 * absent, so callers can fall back to whatever they can compute locally. The
 * failure is logged first: a refused call used to look exactly like a place
 * with no match, which hid a missing IAM permission for weeks (issue #311). This
 * is the only place that talks to the geocoder, so callers on the server can
 * use it directly instead of making an HTTP round trip to /api/places/geocode.
 */
export async function geocodePlace(q: string): Promise<GeocodeResult | null> {
  const query = q.trim();
  if (!query) return null;

  try {
    // Australia only, as autocomplete is. Unfiltered, "St Kilda" resolves to
    // the one in Scotland and every event ends up 17,000km away.
    const res = await client.send(new GeocodeCommand({
      QueryText: query,
      Filter: { IncludeCountries: ["AUS"] },
    }));
    const item = res.ResultItems?.[0];
    if (!item?.Address) return null;

    return toGeocodeResult(item);
  } catch (err) {
    console.error("[geocode] AWS Location Service lookup failed:", err);
    return null;
  }
}
