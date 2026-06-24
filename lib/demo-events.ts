import type { PublicEvent } from "@/lib/events";

/** Local dev fallback when the database is empty or unavailable. */
export function getDemoMapEvents(): PublicEvent[] {
  return [
    {
      id: "demo-map-event-melbourne",
      title: "Demo Map Event — Melbourne Marathon",
      discipline: "running",
      tagline: "Fake event for testing the map",
      description:
        "This is a development-only placeholder event. It appears when no approved events are loaded from the database.",
      eventDate: "2026-11-15",
      endDate: null,
      startTime: "07:00",
      endTime: "14:00",
      venue: "Melbourne Cricket Ground",
      city: "Melbourne",
      state: "vic",
      latitude: -37.82,
      longitude: 144.9834,
      format: "individual",
      level: "open",
      categories: ["10K", "Half Marathon"],
      waves: [{ label: "General Entry", date: "2026-10-01", price: "89", qty: 500 }],
      coverImageUrl:
        "https://images.unsplash.com/photo-1452626212852-811d58933cae?w=1200&q=80",
      registrationType: "external",
      registrationUrl: "https://startlineau.com",
      feeStructure: "athlete",
      fromPrice: 89,
      organiserId: "demo-organiser",
      organiser: {
        id: "demo-organiser",
        orgName: "Demo Events Co.",
        logoUrl: null,
        stripeAccountId: null,
        stripeOnboardingComplete: false,
      },
    },
    {
      id: "demo-map-event-sydney",
      title: "Demo Map Event — Sydney Harbour Run",
      discipline: "running",
      tagline: "Second pin for map testing",
      description: "Another dev-only event with coordinates near Sydney Harbour.",
      eventDate: "2026-12-06",
      endDate: null,
      startTime: "06:30",
      endTime: "11:00",
      venue: "Circular Quay",
      city: "Sydney",
      state: "nsw",
      latitude: -33.861,
      longitude: 151.211,
      format: "individual",
      level: "open",
      categories: ["5K", "10K"],
      waves: [{ label: "Early Bird", date: "2026-10-15", price: "55", qty: 200 }],
      coverImageUrl:
        "https://images.unsplash.com/photo-1506973035872-a4ec16b8a785?w=1200&q=80",
      registrationType: "external",
      registrationUrl: "https://startlineau.com",
      feeStructure: "athlete",
      fromPrice: 55,
      organiserId: "demo-organiser",
      organiser: {
        id: "demo-organiser",
        orgName: "Demo Events Co.",
        logoUrl: null,
        stripeAccountId: null,
        stripeOnboardingComplete: false,
      },
    },
  ];
}

export function withDevDemoEvents(events: PublicEvent[]): PublicEvent[] {
  if (process.env.NODE_ENV !== "development") return events;
  if (events.length === 0) return getDemoMapEvents();
  const hasCoordinates = events.some(
    (event) => event.latitude != null && event.longitude != null,
  );
  if (!hasCoordinates) return getDemoMapEvents();
  return events;
}
