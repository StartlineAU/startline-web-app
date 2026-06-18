import type { PublicEvent } from "@/lib/events";
import type { CustomerEvent, TicketDrop, EventType, AustralianState } from "@/types";
import { getEventImage } from "@/lib/images";

function mapDiscipline(discipline: string): EventType {
  const d = discipline.toLowerCase();
  if (d === "fitness-racing") return "fitness-racing";
  if (d === "crossfit")     return "crossfit";
  if (d === "running")      return "running";
  if (d === "hybrid")       return "hybrid";
  if (d === "functionalfitness" || d === "functional_fitness") return "fitness-racing";
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

function lowestPrice(waves: unknown): number | null {
  if (!Array.isArray(waves)) return null;
  const prices = (waves as TicketDrop[])
    .map((w) => parseFloat(w?.price ?? ""))
    .filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : null;
}

export function toCustomerEvent(event: PublicEvent): CustomerEvent {
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
    image: event.coverImageUrl ?? getEventImage(type, event.id),
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

export function toCustomerEvents(events: PublicEvent[]): CustomerEvent[] {
  return events.map(toCustomerEvent);
}
