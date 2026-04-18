import Link from "next/link";
import { MapPin, Clock, Users, Calendar } from "lucide-react";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatMediumDate, formatShortDate, formatTime, formatCompetitionFormat } from "@/lib/utils";
import { getEventImage } from "@/lib/images";
import { getEventStatus } from "@/lib/event-status";
import SaveEventButton from "./SaveEventButton";

interface EventCardProps {
  event: FitnessEvent;
  variant?: "default" | "compact" | "list";
}

export default function EventCard({ event, variant = "default" }: EventCardProps) {
  const typeLabel  = EVENT_TYPE_LABELS[event.type];
  const stateLabel = STATE_LABELS[event.state];
  const [day, month] = formatShortDate(event.date).split(" ");
  const status = getEventStatus(event);

  if (variant === "compact") {
    return (
      <Link href={`/events/${event.id}`} className="group block">
        <article className="bg-dark border border-dark-lighter overflow-hidden rounded-xl hover:border-primary/40 transition-colors">
          <div className="relative aspect-[16/9] image-placeholder overflow-hidden transition-all duration-500">
            <span className="absolute top-2 left-2 text-[10px] font-headline uppercase tracking-widest bg-primary text-dark px-2 py-1 rounded-full">
              {typeLabel}
            </span>
          </div>
          <div className="p-3">
            <h3 className="font-headline text-sm font-bold italic tracking-tighter text-light line-clamp-1 group-hover:text-primary transition-colors">
              {event.title}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-xs font-medium font-headline uppercase tracking-widest text-muted">
              <Calendar className="w-3 h-3 text-primary" />
              <span>{formatMediumDate(event.date)}</span>
              <span className="text-dark-lighter">·</span>
              <span>{stateLabel}</span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  if (variant === "list") {
    return (
      <Link href={`/events/${event.id}`} className="group block">
        <article className="bg-dark border-b border-dark-lighter p-4 hover:bg-dark-light transition-colors">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-14 text-center bg-dark-lighter py-2 px-3">
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">{month}</p>
              <p className="font-headline text-2xl font-black text-light">{day}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-headline text-[10px] uppercase tracking-widest bg-primary text-dark px-2 py-0.5 inline-block mb-1 rounded-full">
                    {typeLabel}
                  </span>
                  <h3 className="font-headline font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-sm text-muted line-clamp-1 mt-1">{event.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs font-medium font-headline uppercase tracking-widest text-muted">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-primary" />
                  {event.city}, {stateLabel}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-primary" />
                  {formatTime(event.time)}
                </span>
              </div>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  // Default card variant
  const bannerUrl = getEventImage(event.type, event.id);

  return (
    <Link href={`/events/${event.id}`} className="block group">
      <article className="bg-dark flex flex-col h-full ring-1 ring-transparent group-hover:ring-primary transition-all duration-200 rounded-xl overflow-hidden">
        {/* Banner image */}
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          <img
            src={bannerUrl}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500 brightness-50 group-hover:brightness-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />

          {/* Status badge + date */}
          <div className="absolute inset-x-0 top-0 p-4 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-headline text-xs font-medium uppercase tracking-widest px-3 py-1 rounded-full ${status.style}`}>
                {status.label}
              </span>
              <SaveEventButton eventId={event.id} className="bg-dark/60 backdrop-blur-sm" />
            </div>
            <div className="bg-dark/80 backdrop-blur-sm px-4 py-2 text-right flex-shrink-0">
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted leading-none mb-1">{month}</p>
              <p className="font-headline text-2xl font-black text-light leading-none">{day}</p>
            </div>
          </div>

          {/* Type label + title */}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <span className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-1 inline-block">
              {typeLabel}
            </span>
            <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-200 leading-tight">
              {event.title}
            </h3>
          </div>
        </div>

        {/* Card body */}
        <div className="p-5 flex flex-col flex-1">
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted">
              <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{event.location}, {stateLabel}</span>
            </div>
            <div className="flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted">
              <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{formatTime(event.time)}</span>
              {event.endTime && <span>— {formatTime(event.endTime)}</span>}
            </div>
            <div className="flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted">
              <Users className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{formatCompetitionFormat(event.format)}</span>
              {event.distance && (
                <>
                  <span className="text-dark-lighter">·</span>
                  <span>{event.distance}</span>
                </>
              )}
            </div>
          </div>
          <p className="text-sm font-medium text-muted border-l-2 border-dark-lighter pl-4 line-clamp-2 flex-1">
            {event.description}
          </p>
        </div>
      </article>
    </Link>
  );
}
