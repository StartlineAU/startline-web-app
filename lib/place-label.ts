/**
 * AWS Location Service names the country by its formal title, so every
 * address label ends in "Commonwealth of Australia". Nobody writes their
 * address that way; show "Australia" instead.
 */
const FORMAL_COUNTRY = /\bCommonwealth of Australia\b/g;

export function tidyPlaceLabel(label: string): string {
  return label.replace(FORMAL_COUNTRY, "Australia");
}
