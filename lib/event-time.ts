/**
 * Event dates and times are entered at the venue, so they are stored as local
 * wall-clock values plus an IANA timezone. Lifecycle decisions use the derived
 * UTC instants below: daylight-saving transitions mean a fixed offset or the
 * server's own timezone would put some events at the wrong moment.
 */

export const DEFAULT_EVENT_TIME_ZONE = "Australia/Sydney";

/** Australian state/territory abbreviations to their IANA timezone. */
const STATE_TIME_ZONES: Record<string, string> = {
  nsw: "Australia/Sydney",
  vic: "Australia/Melbourne",
  act: "Australia/Sydney",
  tas: "Australia/Hobart",
  qld: "Australia/Brisbane",
  sa: "Australia/Adelaide",
  nt: "Australia/Darwin",
  wa: "Australia/Perth",
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function timeZoneForState(state: string | null | undefined): string {
  return STATE_TIME_ZONES[String(state ?? "").trim().toLowerCase()] ?? DEFAULT_EVENT_TIME_ZONE;
}

export function isValidEventDate(value: string | null | undefined): boolean {
  const match = DATE_RE.exec(String(value ?? "").trim());
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

export function isValidEventTime(value: string | null | undefined): boolean {
  return TIME_RE.test(String(value ?? "").trim());
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/** The timezone's offset from UTC at a specific instant, in milliseconds. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convert a venue-local date/time to the UTC instant it names. The offset is
 * looked up against the candidate instant and refined once, which handles the
 * offset changing on a daylight-saving boundary.
 */
export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string = DEFAULT_EVENT_TIME_ZONE,
): Date | null {
  if (!isValidEventDate(date) || !isValidEventTime(time)) return null;
  const match = DATE_RE.exec(date.trim())!;
  const timeMatch = TIME_RE.exec(time.trim())!;
  const naive = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );

  let utc = naive;
  for (let i = 0; i < 3; i += 1) {
    const next = naive - timeZoneOffsetMs(new Date(utc), timeZone);
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

export interface EventTimeInput {
  eventDate: string;
  endDate?: string | null;
  startTime: string;
  endTime?: string | null;
  state?: string | null;
  timeZone?: string | null;
}

export interface EventTimeWindow {
  timeZone: string;
  startsAtUtc: Date | null;
  endsAtUtc: Date | null;
}

/**
 * The UTC window an event occupies. A missing end time historically meant the
 * event was current until the end of its calendar day, so that remains the
 * fallback instead of a blank end making the event look instantaneous.
 */
export function eventUtcWindow(input: EventTimeInput): EventTimeWindow {
  const timeZone =
    input.timeZone && input.timeZone.includes("/")
      ? input.timeZone
      : timeZoneForState(input.state);
  const lastDate = isValidEventDate(input.endDate) ? input.endDate! : input.eventDate;
  const endTime = isValidEventTime(input.endTime) ? input.endTime! : "23:59";

  return {
    timeZone,
    startsAtUtc: localDateTimeToUtc(input.eventDate, input.startTime, timeZone),
    endsAtUtc: localDateTimeToUtc(lastDate, endTime, timeZone),
  };
}

/** The stored fields to merge into an event create/update. */
export function eventTimeData(input: EventTimeInput) {
  const window = eventUtcWindow(input);
  return {
    timeZone: window.timeZone,
    startsAtUtc: window.startsAtUtc,
    endsAtUtc: window.endsAtUtc,
  };
}

/** Render a UTC instant in the event's own timezone. */
export function formatInEventTimeZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("en-AU", { ...options, timeZone }).format(date);
}
