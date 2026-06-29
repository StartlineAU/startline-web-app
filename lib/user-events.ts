import type { PublicEvent } from "@/lib/events";
import type { UserEvent, TicketDrop, EventType, AustralianState } from "@/types";
import { getEventImage } from "@/lib/images";

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

function lowestPrice(waves: unknown): number | null {
  if (!Array.isArray(waves)) return null;
  const prices = (waves as TicketDrop[])
    .map((w) => parseFloat(w?.price ?? ""))
    .filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : null;
}

export function toUserEvent(event: PublicEvent): UserEvent {
  const discipline = event.format?.discipline ?? "";
  const type = mapDiscipline(discipline);
  const waves = event.tickets?.waves ?? [];
  const ticketDrops = parseWaves(waves);

  return {
    id: event.id,
    title: event.basics?.title ?? "",
    description: event.basics?.description ?? "",
    fullDescription: event.basics?.tagline ?? undefined,
    date: event.schedule?.eventDate ?? "",
    time: event.schedule?.startTime ?? "",
    endTime: event.schedule?.endTime ?? undefined,
    location: event.schedule?.venue ?? "",
    city: event.schedule?.city ?? "",
    state: mapState(event.schedule?.state ?? ""),
    type,
    format: event.format?.format ?? "",
    level: event.format?.level ?? "",
    image: event.details?.coverImageUrl ?? getEventImage(type, event.id),
    registrationUrl: event.tickets?.registrationUrl ?? null,
    registrationType: event.tickets?.registrationType ?? "startline",
    feeStructure: event.tickets?.feeStructure ?? "athlete",
    organiserId: event.organiserId,
    organizer: event.organiser?.orgName ?? undefined,
    distance: undefined,
    isOfficial: false,
    ticketDrops,
    fromPrice: lowestPrice(waves),
    tagline: event.basics?.tagline,
    coverImageUrl: event.details?.coverImageUrl ?? null,
    organiser: event.organiser
      ? {
          id: event.organiser.id,
          orgName: event.organiser.orgName,
          logoUrl: event.organiser.logoUrl ?? null,
        }
      : undefined,
  };
}

export function toUserEvents(events: PublicEvent[]): UserEvent[] {
  return events.map(toUserEvent);
}
