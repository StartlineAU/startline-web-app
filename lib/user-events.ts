import { type PublicEvent, lowestPrice } from "@/lib/event-types";
import type { UserEvent, TicketDrop, EventType, AustralianState } from "@/types";

function mapDiscipline(discipline: string): EventType {
  const d = discipline.toLowerCase();
  if (d === "crossfit")       return "crossfit";
  if (d === "running")        return "running";
  if (d === "hybrid")         return "hybrid";
  if (d === "swimming")       return "swimming";
  if (d === "cycling")        return "cycling";
  if (d === "triathlon")      return "triathlon";
  if (d === "duathlon")       return "duathlon";
  if (d === "weightlifting")  return "weightlifting";
  if (d === "bodybuilding")   return "bodybuilding";
  return "running";
}

function mapState(state: string): AustralianState {
  const s = state.toLowerCase();
  if (s === "nsw" || s === "new south wales") return "nsw";
  if (s === "vic" || s === "victoria")        return "vic";
  if (s === "qld" || s === "queensland")      return "qld";
  if (s === "wa"  || s === "western australia") return "wa";
  if (s === "sa"  || s === "south australia") return "sa";
  if (s === "tas" || s === "tasmania")        return "tas";
  if (s === "act")                            return "act";
  if (s === "nt"  || s === "northern territory") return "nt";
  return "nsw";
}

function parseWaves(waves: unknown): TicketDrop[] {
  if (!Array.isArray(waves)) return [];
  return waves as TicketDrop[];
}

export function toUserEvent(event: PublicEvent): UserEvent {
  const type = mapDiscipline(event.discipline);
  const waves = event.waves ?? [];
  const ticketDrops = parseWaves(waves);

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    fullDescription: event.tagline ?? undefined,
    date: event.eventDate,
    time: event.startTime,
    endTime: event.endTime ?? undefined,
    location: event.venue,
    city: event.city,
    state: mapState(event.state),
    type,
    format: event.format,
    level: event.level,
    image: event.coverImageUrl ?? "/images/placeholder-event.svg",
    registrationUrl: event.registrationUrl,
    registrationType: event.registrationType,
    feeStructure: event.feeStructure,
    organiserId: event.organiserId,
    organizer: event.organiser?.orgName ?? undefined,
    distance: undefined,
    isOfficial: false,
    ticketDrops,
    fromPrice: lowestPrice(waves),
    tagline: event.tagline,
    coverImageUrl: event.coverImageUrl,
    organiser: event.organiser,
  };
}

export function toUserEvents(events: PublicEvent[]): UserEvent[] {
  return events.map(toUserEvent);
}
