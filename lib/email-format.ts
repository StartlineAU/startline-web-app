import { format, parseISO } from "date-fns";
import { formatTime } from "@/lib/utils";

// Events store dates as `yyyy-mm-dd` and times as `HH:mm`. Emails show them
// the way design.md writes them (`Sat, 21 Nov 2026`, `7:00 AM`). Anything
// that is not in the stored shape passes through untouched, so a caller that
// already formatted a value is not mangled.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^\d{1,2}:\d{2}$/;

export function formatEmailDate(value: string): string;
export function formatEmailDate(value: string | null | undefined): string | null;
export function formatEmailDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return ISO_DATE.test(v) ? format(parseISO(v), "EEE, d MMM yyyy") : v;
}

export function formatEmailTime(value: string): string;
export function formatEmailTime(value: string | null | undefined): string | null;
export function formatEmailTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return HH_MM.test(v) ? formatTime(v) : v;
}

const calendarStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * A Google Calendar "add event" link. Built from the UTC instants, so it lands
 * at the right local time whatever the reader's calendar zone. Null when the
 * event has no start instant yet.
 */
export function googleCalendarUrl(event: {
  title: string;
  startsAtUtc?: Date | string | null;
  endsAtUtc?: Date | string | null;
  location?: string;
  details?: string;
}): string | null {
  if (!event.startsAtUtc) return null;
  const start = new Date(event.startsAtUtc);
  if (Number.isNaN(start.getTime())) return null;
  const endRaw = event.endsAtUtc ? new Date(event.endsAtUtc) : null;
  const end = endRaw && !Number.isNaN(endRaw.getTime()) && endRaw > start
    ? endRaw
    : new Date(start.getTime() + 60 * 60 * 1000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${calendarStamp(start)}/${calendarStamp(end)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.details) params.set("details", event.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
