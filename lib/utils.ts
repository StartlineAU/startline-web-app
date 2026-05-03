import { format, parseISO, isAfter, isBefore, startOfDay, addMonths, endOfMonth } from "date-fns";
import { FitnessEvent, FilterState, AustralianState } from "@/types";

// ── Date formatting ────────────────────────────────────────────────────────

export function formatEventDate(dateString: string): string {
  return format(parseISO(dateString), "EEEE, d MMMM yyyy");
}

export function formatShortDate(dateString: string): string {
  return format(parseISO(dateString), "d MMM");
}

export function formatMediumDate(dateString: string): string {
  return format(parseISO(dateString), "d MMM yyyy");
}

/** Converts a 24-hour time string (e.g. "09:30") to 12-hour AM/PM format. */
export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// ── Label formatters ───────────────────────────────────────────────────────

/** Maps a CompetitionFormat value to a human-readable string. */
export function formatCompetitionFormat(format: string): string {
  if (format === "team") return "Team";
  if (format === "both") return "Individual & Team";
  return "Individual";
}

/** Maps an ExperienceLevel value to a human-readable string. */
export function formatExperienceLevel(level: string): string {
  if (level === "elite")   return "Elite";
  if (level === "beginner") return "Beginner";
  return "Open";
}

// ── Date helpers ───────────────────────────────────────────────────────────

/** Returns true if the event date is today or in the future. */
function isOnOrAfterToday(dateString: string, today: Date): boolean {
  const eventDate = parseISO(dateString);
  return isAfter(eventDate, today) ||
    format(eventDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
}

// ── Filtering & sorting ────────────────────────────────────────────────────

export function filterEvents(
  events: FitnessEvent[],
  filters: FilterState
): FitnessEvent[] {
  const today = startOfDay(new Date());

  return events.filter((event) => {
    const eventDate = startOfDay(parseISO(event.date));

    // Only show upcoming (and today's) events
    if (isBefore(eventDate, today)) return false;

    if (filters.types.length > 0 && !filters.types.includes(event.type)) return false;
    if (filters.states.length > 0 && !filters.states.includes(event.state)) return false;

    if (filters.format) {
      if (filters.format === "individual" && event.format === "team")   return false;
      if (filters.format === "team"       && event.format === "individual") return false;
    }

    if (filters.dateRange === "this-month") {
      if (isAfter(eventDate, endOfMonth(today))) return false;
    } else if (filters.dateRange === "next-3") {
      if (isAfter(eventDate, addMonths(today, 3))) return false;
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matches =
        event.title.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q) ||
        event.city.toLowerCase().includes(q) ||
        (event.organizer?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
    }

    return true;
  });
}

export function sortEventsByDate(events: FitnessEvent[]): FitnessEvent[] {
  return [...events].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
}

export function getUpcomingEvents(events: FitnessEvent[], limit = 10): FitnessEvent[] {
  const today = startOfDay(new Date());
  const upcoming = events.filter((e) => isOnOrAfterToday(e.date, today));
  return sortEventsByDate(upcoming).slice(0, limit);
}

export function getEventsByState(events: FitnessEvent[]): Record<AustralianState, number> {
  const today = startOfDay(new Date());
  const counts: Record<AustralianState, number> = {
    nsw: 0, vic: 0, qld: 0, wa: 0, sa: 0, tas: 0, act: 0, nt: 0,
  };
  for (const event of events) {
    if (isOnOrAfterToday(event.date, today)) counts[event.state]++;
  }
  return counts;
}

export function getEventsByType(events: FitnessEvent[]): Record<string, number> {
  const today = startOfDay(new Date());
  const counts: Record<string, number> = { functional_fitness: 0, crossfit: 0, running: 0, hybrid: 0 };
  for (const event of events) {
    if (isOnOrAfterToday(event.date, today)) counts[event.type]++;
  }
  return counts;
}

export function getTotalUpcomingEvents(events: FitnessEvent[]): number {
  const today = startOfDay(new Date());
  return events.filter((e) => isOnOrAfterToday(e.date, today)).length;
}

// ── Misc ───────────────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Truncates an event title to `maxLength` chars so card layouts stay consistent. */
export function truncateTitle(title: string, maxLength = 28): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength).trimEnd() + "…";
}
