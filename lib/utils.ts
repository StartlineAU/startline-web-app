import { format, parseISO, isAfter, isBefore, startOfDay, addMonths, endOfMonth } from "date-fns";
import { FitnessEvent, FilterState, AustralianState } from "@/types";

export function formatEventDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "EEEE, d MMMM yyyy");
}

export function formatShortDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "d MMM");
}

export function formatMediumDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "d MMM yyyy");
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
  const today = startOfDay(new Date());
  
  return events.filter((event) => {
    const eventDate = startOfDay(parseISO(event.date));
    
    // Only show upcoming events
    if (isBefore(eventDate, today)) {
      return false;
    }

    // Filter by event types
    if (filters.types.length > 0 && !filters.types.includes(event.type)) {
      return false;
    }

    // Filter by states
    if (filters.states.length > 0 && !filters.states.includes(event.state)) {
      return false;
    }

    // Filter by format
    if (filters.format) {
      if (filters.format === "individual" && event.format === "team") {
        return false;
      }
      if (filters.format === "team" && event.format === "individual") {
        return false;
      }
    }

    // Filter by date range
    if (filters.dateRange === "this-month") {
      const endOfThisMonth = endOfMonth(today);
      if (isAfter(eventDate, endOfThisMonth)) {
        return false;
      }
    } else if (filters.dateRange === "next-3") {
      const threeMonthsFromNow = addMonths(today, 3);
      if (isAfter(eventDate, threeMonthsFromNow)) {
        return false;
      }
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = event.title.toLowerCase().includes(query);
      const matchesLocation = event.location.toLowerCase().includes(query);
      const matchesCity = event.city.toLowerCase().includes(query);
      const matchesOrganizer = event.organizer?.toLowerCase().includes(query);
      
      if (!matchesTitle && !matchesLocation && !matchesCity && !matchesOrganizer) {
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

export function getUpcomingEvents(events: FitnessEvent[], limit: number = 10): FitnessEvent[] {
  const today = startOfDay(new Date());
  const upcoming = events.filter((event) => {
    const eventDate = parseISO(event.date);
    return isAfter(eventDate, today) || format(eventDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  });
  return sortEventsByDate(upcoming).slice(0, limit);
}

export function getEventsByState(events: FitnessEvent[]): Record<AustralianState, number> {
  const counts: Record<AustralianState, number> = {
    nsw: 0,
    vic: 0,
    qld: 0,
    wa: 0,
    sa: 0,
    tas: 0,
    act: 0,
    nt: 0,
  };
  
  const today = startOfDay(new Date());
  
  events.forEach((event) => {
    const eventDate = parseISO(event.date);
    if (isAfter(eventDate, today) || format(eventDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
      counts[event.state]++;
    }
  });
  
  return counts;
}

export function getEventsByType(events: FitnessEvent[]): Record<string, number> {
  const counts: Record<string, number> = {
    hyrox: 0,
    crossfit: 0,
    running: 0,
    hybrid: 0,
  };
  
  const today = startOfDay(new Date());
  
  events.forEach((event) => {
    const eventDate = parseISO(event.date);
    if (isAfter(eventDate, today) || format(eventDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
      counts[event.type]++;
    }
  });
  
  return counts;
}

export function getTotalUpcomingEvents(events: FitnessEvent[]): number {
  const today = startOfDay(new Date());
  return events.filter((event) => {
    const eventDate = parseISO(event.date);
    return isAfter(eventDate, today) || format(eventDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  }).length;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
