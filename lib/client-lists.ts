const SAVED_KEY = "startline_saved_events";
const REGISTERED_KEY = "startline_registered_interest";

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

export function getSavedEventIds(): string[] {
  if (typeof window === "undefined") return [];
  return parseIds(localStorage.getItem(SAVED_KEY));
}

function notifyListsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("startline-lists-changed"));
}

function setSavedEventIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  notifyListsChanged();
}

export function toggleSavedEventId(eventId: string): boolean {
  const ids = getSavedEventIds();
  const i = ids.indexOf(eventId);
  if (i >= 0) {
    ids.splice(i, 1);
    setSavedEventIds(ids);
    return false;
  }
  ids.push(eventId);
  setSavedEventIds(ids);
  return true;
}

export function getRegisteredEventIds(): string[] {
  if (typeof window === "undefined") return [];
  return parseIds(localStorage.getItem(REGISTERED_KEY));
}

function setRegisteredEventIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REGISTERED_KEY, JSON.stringify(ids));
  notifyListsChanged();
}

export function addRegisteredInterest(eventId: string): boolean {
  const ids = getRegisteredEventIds();
  if (ids.includes(eventId)) return false;
  ids.push(eventId);
  setRegisteredEventIds(ids);
  return true;
}
