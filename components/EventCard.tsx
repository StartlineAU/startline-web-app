import Link from "next/link";
import { MapPin, Clock, Users, Calendar, ArrowRight } from "lucide-react";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatMediumDate, formatShortDate, formatTime } from "@/lib/utils";

const TYPE_IMAGES: Record<string, string[]> = {
  hyrox: [
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=70",
    "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=70",
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800&q=70",
  ],
  crossfit: [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=70",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=70",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&q=70",
  ],
  running: [
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=70",
    "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&q=70",
    "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&q=70",
  ],
  hybrid: [
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=70",
    "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=70",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&q=70",
  ],
};

function getBannerImage(type: string, id: string): string {
  const pool = TYPE_IMAGES[type] ?? TYPE_IMAGES.running;
  const idx = id.charCodeAt(id.length - 1) % pool.length;
  return pool[idx];
}

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
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                {month}
              </p>
              <p className="font-headline text-2xl font-black text-light">
                {day}
              </p>
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
                  <p className="text-sm text-muted line-clamp-1 mt-1">
                    {event.description}
                  </p>
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

  // Default HUD card variant
  const bannerUrl = getBannerImage(event.type, event.id);

  return (
    <Link href={`/events/${event.id}`} className="block group">
    <article className="bg-dark flex flex-col h-full ring-1 ring-transparent group-hover:ring-primary transition-all duration-200 rounded-xl overflow-hidden">
      {/* ── Banner image section ── */}
      <div className="relative h-44 overflow-hidden flex-shrink-0">
        <img
          src={bannerUrl}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500 brightness-50 group-hover:brightness-60"
        />
        {/* Gradient fade into card body */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />

        {/* Status badge + date — overlaid on image */}
        <div className="absolute inset-x-0 top-0 p-4 flex items-start justify-between">
          <span
            className={`font-headline text-xs font-medium uppercase tracking-widest px-3 py-1 rounded-full ${status.style}`}
          >
            {status.label}
          </span>
          <div className="bg-dark/80 backdrop-blur-sm px-4 py-2 text-right flex-shrink-0">
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted leading-none mb-1">
              {month}
            </p>
            <p className="font-headline text-2xl font-black text-light leading-none">
              {day}
            </p>
          </div>
        </div>

        {/* Type tag + title — pinned to bottom of image */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-1 inline-block">
            {typeLabel}
          </span>
          <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-200 leading-tight">
            {event.title}
          </h3>
        </div>
      </div>

      {/* ── Card body (no image) ── */}
      <div className="p-5 flex flex-col flex-1">
        {/* Meta icons */}
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
            <span>
              {event.format === "team" ? "Team" : event.format === "both" ? "Individual & Team" : "Individual"}
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
        <p className="text-sm font-medium text-muted border-l-2 border-dark-lighter pl-4 line-clamp-2 flex-1">
          {event.description}
        </p>
      </div>
    </article>
    </Link>
  );
}
