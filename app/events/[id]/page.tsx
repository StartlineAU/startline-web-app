import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Users, ExternalLink, ArrowRight } from "lucide-react";
import eventsData from "@/data/events.json";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatTime, formatShortDate } from "@/lib/utils";
import { fetchAllEvents } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TYPE_IMAGES: Record<string, string[]> = {
  hyrox: [
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1920&q=80",
    "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1920&q=80",
    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1920&q=80",
  ],
  crossfit: [
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920&q=80",
    "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1920&q=80",
  ],
  running: [
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1920&q=80",
    "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1920&q=80",
    "https://images.unsplash.com/photo-1544717305-2782549b5136?w=1920&q=80",
  ],
  hybrid: [
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1920&q=80",
    "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1920&q=80",
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1920&q=80",
  ],
};

function getBannerImage(type: string, id: string): string {
  const pool = TYPE_IMAGES[type] ?? TYPE_IMAGES.running;
  return pool[id.charCodeAt(id.length - 1) % pool.length];
}

function getRelatedImage(type: string, id: string): string {
  const pool = TYPE_IMAGES[type] ?? TYPE_IMAGES.running;
  return pool[(id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % pool.length];
}

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

function getStatusLabel(event: FitnessEvent): { label: string; style: string } {
  const daysUntil = Math.ceil(
    (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0)  return { label: "Registration Closed", style: "bg-dark-lighter text-muted" };
  if (daysUntil <= 14) return { label: "Selling Fast",         style: "bg-primary text-dark" };
  return                       { label: "Live Registration",   style: "bg-primary text-dark" };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const liveEvents = await fetchAllEvents();
  const events: FitnessEvent[] = liveEvents.length > 0
    ? liveEvents
    : (eventsData.events as FitnessEvent[]);
  const event = events.find((e) => e.id === id);
  if (!event) notFound();

  const typeLabel   = EVENT_TYPE_LABELS[event.type];
  const stateLabel  = STATE_LABELS[event.state];
  const status      = getStatusLabel(event);
  const [day, month] = formatShortDate(event.date).split(" ");
  const bannerUrl   = getBannerImage(event.type, event.id);
  const mapsUrl     = `https://maps.google.com/?q=${encodeURIComponent(event.location + ", " + event.city + ", Australia")}`;

  const formatLabel =
    event.format === "team"  ? "Team" :
    event.format === "both"  ? "Individual & Team" : "Individual";

  const relatedEvents = events
    .filter((e) => e.id !== event.id && e.type === event.type)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-dark-darker">

      {/* ── HERO ── */}
      <section className="relative h-[700px] w-full overflow-hidden">
        <img
          src={bannerUrl}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover brightness-50"
        />
        {/* Gradient fade at bottom only */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/40 to-transparent" />

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 pb-12">
          <div className="max-w-[1440px] mx-auto px-8">
          <div className="max-w-3xl">
            {/* Back link */}
            <Link
              href="/events"
              className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6 group"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              All Events
            </Link>

            {/* Status + type badges */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className={`font-headline text-xs font-bold uppercase tracking-widest px-3 py-1.5 ${status.style}`}>
                {status.label}
              </span>
              <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                {typeLabel}
              </span>
              {event.isOfficial && (
                <span className="font-headline text-xs font-medium uppercase tracking-widest text-primary border border-primary/40 px-2 py-1">
                  Official
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-headline text-6xl md:text-8xl font-black italic tracking-tighter leading-none mb-4 text-light">
              {event.title.split(" ").map((word, i, arr) =>
                i === arr.length - 1
                  ? <span key={i} className="text-primary"> {word}</span>
                  : <span key={i}>{i > 0 ? " " : ""}{word}</span>
              )}
            </h1>

            <p className="font-headline font-medium max-w-xl text-muted leading-relaxed mb-6">
              {event.description}
            </p>

            {/* Register button under description */}
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-4 bg-primary hover:bg-primary/90 text-dark font-headline font-black text-xl uppercase tracking-tighter px-8 py-5 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all duration-100 active:translate-x-0 active:translate-y-0"
            >
              REGISTER NOW
              <ExternalLink className="w-6 h-6" />
            </a>
          </div>
        </div>
          </div>
      </section>

      {/* ── SPECS BENTO ── */}
      <section className="max-w-[1440px] mx-auto px-8 py-0.5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0.5 bg-dark-darker">

          {/* Schedule tile */}
          <div className="bg-dark p-8 flex flex-col justify-between">
            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase mb-2 block">
                Schedule Log
              </span>
              <div className="font-headline text-5xl font-black uppercase text-primary leading-none mt-1">
                {day}
              </div>
              <div className="font-headline text-lg font-bold uppercase text-light mt-1">{month}</div>
            </div>
            <div className="flex justify-between items-end mt-6">
              <span className="font-headline text-xs text-muted uppercase tracking-widest">Start Time</span>
              <span className="font-headline text-xl font-bold italic text-light">
                {formatTime(event.time)}
              </span>
            </div>
            {event.endTime && (
              <div className="flex justify-between items-end mt-2">
                <span className="font-headline text-xs text-muted uppercase tracking-widest">End Time</span>
                <span className="font-headline text-xl font-bold italic text-light">
                  {formatTime(event.endTime)}
                </span>
              </div>
            )}
          </div>

          {/* Race Config tile */}
          <div className="bg-dark p-8 flex flex-col justify-between">
            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase mb-2 block">
                Race Config
              </span>
              <div className="font-headline text-4xl font-black uppercase text-primary leading-none mt-1">
                {event.distance ?? formatLabel}
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-6">
              <div className="flex justify-between items-end">
                <span className="font-headline text-xs text-muted uppercase tracking-widest">Format</span>
                <span className="font-headline text-sm font-bold italic text-light">{formatLabel}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="font-headline text-xs text-muted uppercase tracking-widest">Level</span>
                <span className="font-headline text-sm font-bold italic text-light">
                  {event.level === "elite" ? "Elite" : event.level === "beginner" ? "Beginner" : "Open"}
                </span>
              </div>
            </div>
          </div>

          {/* Course Overview tile (col-span-2) */}
          <div className="bg-dark p-8 md:col-span-2 flex flex-col gap-5">
            <span className="font-headline text-xs tracking-widest text-muted uppercase">
              Course Overview
            </span>
            <p className="font-headline text-base font-medium leading-relaxed text-muted max-w-3xl">
              {event.description}
            </p>
            <div className="flex flex-wrap gap-3 mt-auto">
              {/* Discipline */}
              <div className="bg-primary px-4 py-2 flex items-center gap-2">
                <span className="font-headline text-xs uppercase tracking-widest font-bold text-dark">
                  {typeLabel}
                </span>
              </div>
              {/* Official badge */}
              {event.isOfficial && (
                <div className="bg-primary/10 border border-primary/40 px-4 py-2 flex items-center gap-2">
                  <span className="font-headline text-xs uppercase tracking-widest font-bold text-primary">
                    Official Event
                  </span>
                </div>
              )}
              {/* Organiser */}
              {event.organizer && (
                <div className="bg-dark-lighter px-4 py-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-headline text-xs uppercase tracking-widest font-bold text-light">
                    {event.organizer}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Location tile (col-span-3) */}
          <div className="bg-dark p-8 flex flex-col justify-between md:col-span-3">
            <div className="flex justify-between">
              <div>
                <span className="font-headline text-xs tracking-widest text-muted uppercase mb-2 block">
                  Location
                </span>
                <div className="font-headline text-3xl font-black uppercase text-light leading-tight">
                  {event.location}
                </div>
                <div className="font-headline text-sm text-muted uppercase tracking-widest mt-1">
                  {event.city}, {stateLabel}
                </div>
              </div>
              <MapPin className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
            </div>
            {/* Map placeholder */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 h-36 w-full bg-dark-lighter border border-dark-lighter overflow-hidden relative group block"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <MapPin className="w-6 h-6 text-primary" />
                <span className="font-headline text-xs font-bold uppercase tracking-widest text-primary group-hover:underline">
                  View on Google Maps
                </span>
                <span className="font-headline text-xs text-muted uppercase tracking-widest">
                  {event.city}, {stateLabel}
                </span>
              </div>
              {/* Subtle grid lines for map feel */}
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "linear-gradient(#d4ff00 1px, transparent 1px), linear-gradient(90deg, #d4ff00 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
            </a>
          </div>

          {/* Registration tile (col-span-1, border-left accent) */}
          <div className="bg-dark border-l-4 border-primary p-8 flex flex-col justify-between">
            <div>
              <span className="font-headline text-xs tracking-widest text-muted uppercase mb-2 block">
                Registration
              </span>
              {event.organizer && (
                <p className="font-headline text-sm font-medium uppercase tracking-widest text-muted mt-2">
                  By {event.organizer}
                </p>
              )}
            </div>
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-between bg-primary hover:bg-primary/90 text-dark font-headline text-sm font-black uppercase tracking-widest px-5 py-4 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all duration-100 active:translate-x-0 active:translate-y-0"
            >
              <span>Register Now</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

        </div>
      </section>

      {/* ── RELATED EVENTS ── */}
      {relatedEvents.length > 0 && (
        <section className="bg-dark py-16 mt-0.5">
          <div className="max-w-[1440px] mx-auto px-8">
            <div className="flex justify-between items-end mb-10 border-b border-dark-lighter pb-6">
              <h2 className="font-headline text-4xl font-black uppercase tracking-tighter italic text-light">
                RECOMMENDED <span className="text-primary">EVENTS</span>
              </h2>
              <Link
                href="/events"
                className="font-headline text-sm font-bold text-primary hover:text-light transition-colors flex items-center gap-2 group"
              >
                VIEW ALL EVENTS
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5 bg-dark-darker">
              {relatedEvents.map((related) => {
                const [relDay, relMonth] = formatShortDate(related.date).split(" ");
                const relImg = getRelatedImage(related.type, related.id);
                return (
                  <Link key={related.id} href={`/events/${related.id}`} className="group bg-dark-darker overflow-hidden border border-dark-lighter/5 hover:border-primary/30 transition-all">
                    <div className="relative h-56 overflow-hidden">
                      <img
                        src={relImg}
                        alt={related.title}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                      />
                      <div className="absolute top-3 right-3 bg-dark/80 backdrop-blur-sm px-3 py-1">
                        <span className="font-headline text-xs font-bold tracking-widest uppercase text-muted">
                          {EVENT_TYPE_LABELS[related.type]}
                        </span>
                      </div>
                    </div>
                    <div className="bg-dark p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-headline text-xl font-black uppercase italic leading-tight text-light group-hover:text-primary transition-colors flex-1">
                          {related.title}
                        </h3>
                      </div>
                      <div className="flex justify-between items-center font-headline text-xs uppercase tracking-widest text-muted">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-primary" />
                          {related.city}, {STATE_LABELS[related.state]}
                        </span>
                        <span>{relDay} {relMonth}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── BACK CTA ── */}
      <div className="max-w-[1440px] mx-auto px-8 py-10">
        <div className="border-t border-dark-lighter pt-8 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors group"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            Back to All Events
          </Link>
          <a
            href={event.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-primary text-dark font-headline text-xs font-black uppercase tracking-widest px-6 py-3 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all duration-100"
          >
            Register
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

    </div>
  );
}

export async function generateStaticParams() {
  const liveEvents = await fetchAllEvents();
  const events: FitnessEvent[] = liveEvents.length > 0
    ? liveEvents
    : (eventsData.events as FitnessEvent[]);
  return events.map((event) => ({ id: event.id }));
}
