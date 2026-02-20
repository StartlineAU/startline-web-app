import { format, parseISO, isWithinInterval, isAfter, isBefore, startOfDay } from "date-fns";
import { FitnessEvent, FilterState, EventType } from "@/types";

export function formatEventDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "EEEE, MMMM d, yyyy");
}

export function formatShortDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "MMM d");
}

export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function filterEvents(
  events: FitnessEvent[],
  filters: FilterState
): FitnessEvent[] {
  return events.filter((event) => {
    // Filter by event types
    if (filters.types.length > 0 && !filters.types.includes(event.type)) {
      return false;
    }

    // Filter by area
    if (
      filters.area &&
      !event.area.toLowerCase().includes(filters.area.toLowerCase()) &&
      !event.location.toLowerCase().includes(filters.area.toLowerCase())
    ) {
      return false;
    }

    // Filter by date range
    const eventDate = startOfDay(parseISO(event.date));
    
    if (filters.dateFrom) {
      const fromDate = startOfDay(parseISO(filters.dateFrom));
      if (isBefore(eventDate, fromDate)) {
        return false;
      }
    }

    if (filters.dateTo) {
      const toDate = startOfDay(parseISO(filters.dateTo));
      if (isAfter(eventDate, toDate)) {
        return false;
      }
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = event.title.toLowerCase().includes(query);
      const matchesDescription = event.description.toLowerCase().includes(query);
      const matchesLocation = event.location.toLowerCase().includes(query);
      
      if (!matchesTitle && !matchesDescription && !matchesLocation) {
        return false;
      }
    }

    return true;
  });
}

export function sortEventsByDate(events: FitnessEvent[]): FitnessEvent[] {
  return [...events].sort((a, b) => {
    const dateA = parseISO(a.date);
    const dateB = parseISO(b.date);
    return dateA.getTime() - dateB.getTime();
  });
}

export function sortEventsByPopularity(events: FitnessEvent[]): FitnessEvent[] {
  return [...events].sort((a, b) => b.popularity - a.popularity);
}

export function getPopularEvents(events: FitnessEvent[], limit: number = 6): FitnessEvent[] {
  return sortEventsByPopularity(events).slice(0, limit);
}

export function getUpcomingEvents(events: FitnessEvent[], limit: number = 10): FitnessEvent[] {
  const today = startOfDay(new Date());
  const upcoming = events.filter((event) => {
    const eventDate = parseISO(event.date);
    return isAfter(eventDate, today) || format(eventDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  });
  return sortEventsByDate(upcoming).slice(0, limit);
}

export function getUniqueAreas(events: FitnessEvent[]): string[] {
  const areas = events.map((event) => event.area);
  return [...new Set(areas)].sort();
}

export function getEventTypeColor(type: EventType): string {
  const colors: Record<EventType, string> = {
    running: "bg-orange-500",
    yoga: "bg-purple-500",
    cycling: "bg-blue-500",
    hiit: "bg-red-500",
    swimming: "bg-cyan-500",
    "group-fitness": "bg-pink-500",
    outdoor: "bg-green-500",
    sports: "bg-yellow-500",
  };
  return colors[type] || "bg-primary";
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
