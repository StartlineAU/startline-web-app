/**
 * Plain-language reason for a failed browser location lookup (#352).
 *
 * The locate button used to clear the Where field on every failure, so a
 * denied permission looked the same as a request that was still loading. The
 * code is the GeolocationPositionError code (1 denied, 2 unavailable,
 * 3 timeout); undefined covers a browser without the API.
 */
export function locationErrorMessage(code?: number | null): string {
  switch (code) {
    case 1:
      return "Location access was denied. Allow location access in your browser, or enter a city or suburb instead.";
    case 2:
      return "Your location is unavailable right now. Enter a city or suburb instead.";
    case 3:
      return "Finding your location took too long. Try again, or enter a city or suburb instead.";
    default:
      return "Your browser could not find your location. Enter a city or suburb instead.";
  }
}
