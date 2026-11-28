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

export function getRegisteredEventIds(): string[] {
  if (typeof window === "undefined") return [];
  return parseIds(localStorage.getItem(REGISTERED_KEY));
}

// Saved events are DB-backed (per-user). These helpers call the API so the
// heart button and activity page stay in sync across devices.
export async function fetchSavedEventIds(): Promise<string[]> {
  try {
    const res = await fetch("/api/user/saved-events");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.eventIds) ? data.eventIds.map(String) : [];
  } catch {
    return [];
  }
}

export async function saveEventId(eventId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/user/saved-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function unsaveEventId(eventId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/user/saved-events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
