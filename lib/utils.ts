import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isAfter, isBefore, startOfDay, addMonths, endOfMonth } from "date-fns";
import type { CustomerEvent, FilterState, AustralianState } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEventDate(dateString: string): string {
  return format(parseISO(dateString), "EEEE, d MMMM yyyy");
}

export function formatShortDate(dateString: string): string {
  return format(parseISO(dateString), "d MMM");
}

export function formatMediumDate(dateString: string): string {
  return format(parseISO(dateString), "d MMM yyyy");
}

export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function formatCompetitionFormat(format: string): string {
  if (format === "team") return "Team";
  if (format === "both") return "Individual & Team";
  return "Individual";
}

export function formatExperienceLevel(level: string): string {
  if (level === "elite")   return "Elite";
  if (level === "beginner") return "Beginner";
  return "Open";
}

function isOnOrAfterToday(dateString: string, today: Date): boolean {
  const eventDate = parseISO(dateString);
  return isAfter(eventDate, today) ||
    format(eventDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
}

export function filterEvents(
  events: CustomerEvent[],
  filters: FilterState
): CustomerEvent[] {
  const today = startOfDay(new Date());

  return events.filter((event) => {
    const eventDate = startOfDay(parseISO(event.date));

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

export function sortEventsByDate(events: CustomerEvent[]): CustomerEvent[] {
  return [...events].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
}

export function getUpcomingEvents(events: CustomerEvent[], limit = 10): CustomerEvent[] {
  const today = startOfDay(new Date());
  const upcoming = events.filter((e) => isOnOrAfterToday(e.date, today));
  return sortEventsByDate(upcoming).slice(0, limit);
}

export function getEventsByState(events: CustomerEvent[]): Record<AustralianState, number> {
  const today = startOfDay(new Date());
  const counts: Record<AustralianState, number> = {
    nsw: 0, vic: 0, qld: 0, wa: 0, sa: 0, tas: 0, act: 0, nt: 0,
  };
  for (const event of events) {
    if (isOnOrAfterToday(event.date, today)) counts[event.state]++;
  }
  return counts;
}

export function getEventsByType(events: CustomerEvent[]): Record<string, number> {
  const today = startOfDay(new Date());
  const counts: Record<string, number> = { hyrox: 0, crossfit: 0, running: 0, hybrid: 0 };
  for (const event of events) {
    if (isOnOrAfterToday(event.date, today)) counts[event.type]++;
  }
  return counts;
}

export function getTotalUpcomingEvents(events: CustomerEvent[]): number {
  const today = startOfDay(new Date());
  return events.filter((e) => isOnOrAfterToday(e.date, today)).length;
}

export function truncateTitle(title: string, maxLength = 28): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength).trimEnd() + "…";
}
