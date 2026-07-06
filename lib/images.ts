const PLACEHOLDER = "/images/placeholder-event.svg";

export function getEventImage(
  _type: string,
  _id: string,
  _width = 800,
  _quality = 70
): string {
  return PLACEHOLDER;
}

export function getAlternateEventImage(
  _type: string,
  _id: string,
  _width = 800,
  _quality = 70
): string {
  return PLACEHOLDER;
}

export function getCategoryImage(
  _type: string,
  _width = 600,
  _quality = 80
): string {
  return PLACEHOLDER;
}

export function getTypeImageArray(
  _type: string,
  _width = 1920,
  _quality = 80
): string[] {
  return [PLACEHOLDER, PLACEHOLDER, PLACEHOLDER];
}
