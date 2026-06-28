import { format } from "date-fns";

export interface UserRegistrationEvent {
  id: string;
  eventId: string;
  athleteName: string;
  waveLabel: string | null;
  category: string | null;
  registeredAt: string;
  event: {
    id: string;
    title: string;
    eventDate: string;
    endDate: string | null;
    startTime: string;
    city: string;
    state: string;
    discipline: string;
    coverImageUrl: string | null;
  };
}

export function todayIsoDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function isUpcomingEventDate(eventDate: string): boolean {
  return eventDate >= todayIsoDate();
}

export function splitRegistrationsByDate<T extends { event: { eventDate: string } }>(
  registrations: T[],
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const reg of registrations) {
    if (isUpcomingEventDate(reg.event.eventDate)) {
      upcoming.push(reg);
    } else {
      past.push(reg);
    }
  }

  upcoming.sort((a, b) => a.event.eventDate.localeCompare(b.event.eventDate));
  past.sort((a, b) => b.event.eventDate.localeCompare(a.event.eventDate));

  return { upcoming, past };
}

export const registrationEventSelect = {
  id: true,
  eventId: true,
  athleteName: true,
  waveLabel: true,
  category: true,
  createdAt: true,
  event: {
    select: {
      id: true,
      title: true,
      eventDate: true,
      endDate: true,
      startTime: true,
      city: true,
      state: true,
      discipline: true,
      coverImageUrl: true,
    },
  },
} as const;

export function serializeRegistration(
  reg: {
    id: string;
    eventId: string;
    athleteName: string;
    waveLabel: string | null;
    category: string | null;
    createdAt: Date;
    event: {
      id: string;
      title: string;
      eventDate: string;
      endDate: string | null;
      startTime: string;
      city: string;
      state: string;
      discipline: string;
      coverImageUrl: string | null;
    };
  },
): UserRegistrationEvent {
  return {
    id: reg.id,
    eventId: reg.eventId,
    athleteName: reg.athleteName,
    waveLabel: reg.waveLabel,
    category: reg.category,
    registeredAt: reg.createdAt.toISOString(),
    event: reg.event,
  };
}
