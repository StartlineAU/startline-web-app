import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";
import { EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import type { EventType, UserEvent } from "@/types";
import { formatShortDate, truncateTitle } from "@/lib/utils";
import { getEventImage } from "@/lib/images";
import SaveEventButton from "@/components/SaveEventButton";
import type { UserRegistrationEvent } from "@/lib/user-registrations";

function mapDiscipline(discipline: string): EventType {
  const d = discipline.toLowerCase();
  if (d === "fitness-racing" || d === "functionalfitness" || d === "functional_fitness") {
    return "fitness-racing";
  }
  if (d === "crossfit") return "crossfit";
  if (d === "hybrid") return "hybrid";
  if (d === "running") return "running";
  return "running";
}

function mapState(state: string): keyof typeof STATE_LABELS {
  const s = state.toLowerCase();
  if (s in STATE_LABELS) return s as keyof typeof STATE_LABELS;
  return "nsw";
}

export interface ProfileEventCardData {
  eventId: string;
  title: string;
  imageUrl: string;
  typeLabel: string;
  city: string;
  stateLabel: string;
  day: string;
  month: string;
  subtitle?: string;
  priceLabel?: string;
  showSaveButton?: boolean;
}

export function userEventToCard(event: UserEvent): ProfileEventCardData {
  const [day, month] = formatShortDate(event.date).split(" ");
  return {
    eventId: String(event.id),
    title: event.title,
    imageUrl: getEventImage(event.type, String(event.id)),
    typeLabel: EVENT_TYPE_LABELS[event.type],
    city: event.city,
    stateLabel: STATE_LABELS[event.state],
    day,
    month,
    priceLabel: event.ticketDrops?.[0]?.price
      ? `From ${event.ticketDrops[0].price}`
      : undefined,
    showSaveButton: true,
  };
}

export function registrationToCard(reg: UserRegistrationEvent): ProfileEventCardData {
  const type = mapDiscipline(reg.event.discipline);
  const [day, month] = formatShortDate(reg.event.eventDate).split(" ");
  return {
    eventId: reg.eventId,
    title: reg.event.title,
    imageUrl: getEventImage(type, reg.eventId),
    typeLabel: EVENT_TYPE_LABELS[type],
    city: reg.event.city,
    stateLabel: STATE_LABELS[mapState(reg.event.state)],
    day,
    month,
    subtitle: reg.waveLabel ?? reg.category ?? undefined,
    showSaveButton: false,
  };
}

interface ProfileEventCarouselCardProps {
  event: ProfileEventCardData;
}

export function ProfileEventCarouselCard({ event }: ProfileEventCarouselCardProps) {
  return (
    <Link
      href={`/events/${event.eventId}`}
      className="group flex-shrink-0 w-[220px] sm:w-[260px]"
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-dark mb-3 rounded-2xl sm:rounded-3xl">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-full object-cover brightness-75 group-hover:brightness-90 transition-all duration-500"
        />
        <div className="absolute top-2.5 left-2.5">
          <span className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-2 py-1 rounded-full">
            {event.typeLabel}
          </span>
        </div>
        {event.showSaveButton && (
          <div className="absolute top-2.5 right-2.5">
            <SaveEventButton eventId={event.eventId} className="bg-dark/60 backdrop-blur-sm" />
          </div>
        )}
      </div>
      <div className="px-0.5">
        <h3 className="font-headline text-sm sm:text-base font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight mb-1">
          {truncateTitle(event.title)}
        </h3>
        <div className="flex items-center gap-1.5 font-headline text-[10px] sm:text-xs text-muted uppercase tracking-widest mb-0.5">
          <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
          {event.city}, {event.stateLabel}
        </div>
        <div className="flex items-center gap-1.5 font-headline text-[10px] sm:text-xs text-muted uppercase tracking-widest">
          <Calendar className="w-3 h-3 text-primary flex-shrink-0" />
          {event.day} {event.month}
        </div>
        {event.subtitle && (
          <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-1.5">
            {event.subtitle}
          </p>
        )}
        {event.priceLabel && (
          <p className="font-headline text-xs font-bold text-light mt-1.5">
            {event.priceLabel}
          </p>
        )}
      </div>
    </Link>
  );
}
