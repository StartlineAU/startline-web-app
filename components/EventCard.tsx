import Link from "next/link";
import { MapPin, Clock, Users, ArrowRight, Calendar } from "lucide-react";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatMediumDate, formatShortDate, formatTime } from "@/lib/utils";

interface EventCardProps {
  event: FitnessEvent;
  variant?: "default" | "compact" | "list";
}

function getStatusLabel(event: FitnessEvent): {
  label: string;
  style: string;
} {
  const eventDate = new Date(event.date);
  const now = new Date();
  const daysUntil = Math.ceil(
    (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 0) {
    return {
      label: "Registration Closed",
      style: "border border-dark-lighter text-muted",
    };
  }
  if (daysUntil <= 14) {
    return {
      label: "Selling Fast",
      style: "bg-primary text-dark",
    };
  }
  return {
    label: "Confirmed",
    style: "border border-primary text-primary",
  };
}

export default function EventCard({
  event,
  variant = "default",
}: EventCardProps) {
  const typeLabel = EVENT_TYPE_LABELS[event.type];
  const stateLabel = STATE_LABELS[event.state];
  const [day, month] = formatShortDate(event.date).split(" ");
  const status = getStatusLabel(event);

  if (variant === "compact") {
    return (
      <Link href={`/events/${event.id}`} className="group block">
        <article className="bg-dark border border-dark-lighter overflow-hidden hover:border-primary/40 transition-colors">
          <div className="relative aspect-[16/9] image-placeholder overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
            <span className="absolute top-2 left-2 text-[10px] font-headline uppercase tracking-widest bg-primary text-dark px-2 py-1">
              {typeLabel}
            </span>
          </div>
          <div className="p-3">
            <h3 className="font-headline text-sm font-bold italic tracking-tighter text-light line-clamp-1 group-hover:text-primary transition-colors">
              {event.title}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-[10px] font-headline uppercase tracking-widest text-muted">
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
              <p className="font-headline text-[10px] uppercase tracking-widest text-muted">
                {month}
              </p>
              <p className="font-headline text-2xl font-black text-light">
                {day}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-headline text-[10px] uppercase tracking-widest bg-primary text-dark px-2 py-0.5 inline-block mb-1">
                    {typeLabel}
                  </span>
                  <h3 className="font-headline font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-sm text-muted line-clamp-1 mt-1">
                    {event.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-[10px] font-headline uppercase tracking-widest text-muted">
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

  // Default HUD card variant
  return (
    <article className="bg-dark group">
      <div className="p-6 sm:p-8 h-full flex flex-col">
        {/* Top row: status badge + date block */}
        <div className="flex items-start justify-between mb-6">
          <span
            className={`font-headline text-[10px] uppercase tracking-widest px-3 py-1 ${status.style}`}
          >
            {status.label}
          </span>
          <div className="bg-dark-lighter px-4 py-2 text-right flex-shrink-0 ml-3">
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted leading-none mb-1">
              {month}
            </p>
            <p className="font-headline text-2xl font-black text-light leading-none">
              {day}
            </p>
          </div>
        </div>

        {/* Type tag */}
        <span className="font-headline text-[10px] uppercase tracking-widest text-primary mb-2 inline-block">
          {typeLabel}
        </span>

        {/* Title */}
        <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-200 mb-4 leading-tight">
          {event.title}
        </h3>

        {/* Meta icons */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
            <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span>
              {event.location}, {stateLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
            <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span>{formatTime(event.time)}</span>
            {event.endTime && (
              <span>— {formatTime(event.endTime)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
            <Users className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span>
              {event.format === "team"
                ? "Team"
                : event.format === "both"
                ? "Individual & Team"
                : "Individual"}
            </span>
            {event.distance && (
              <>
                <span className="text-dark-lighter">·</span>
                <span>{event.distance}</span>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted border-l-2 border-dark-lighter pl-4 line-clamp-2 mb-6 flex-1">
          {event.description}
        </p>

        {/* Footer: View Details */}
        <Link
          href={`/events/${event.id}`}
          className="flex items-center justify-between bg-dark-light text-light font-headline text-[10px] uppercase tracking-widest px-4 py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 group/btn active:translate-x-0 active:translate-y-0"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 text-primary group-hover/btn:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </article>
  );
}
