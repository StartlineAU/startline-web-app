import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Users, Calendar, ExternalLink, ArrowRight } from "lucide-react";
import eventsData from "@/data/events.json";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatEventDate, formatTime, formatMediumDate, formatShortDate } from "@/lib/utils";

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

function getStatusLabel(event: FitnessEvent): { label: string; style: string } {
  const eventDate = new Date(event.date);
  const now = new Date();
  const daysUntil = Math.ceil(
    (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0) return { label: "Registration Closed", style: "border border-dark-lighter text-muted" };
  if (daysUntil <= 14) return { label: "Selling Fast", style: "bg-primary text-dark" };
  return { label: "Live Registration", style: "bg-primary text-dark" };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const events = eventsData.events as FitnessEvent[];
  const event = events.find((e) => e.id === id);

  if (!event) notFound();

  const typeLabel = EVENT_TYPE_LABELS[event.type];
  const stateLabel = STATE_LABELS[event.state];
  const status = getStatusLabel(event);
  const [day, month] = formatShortDate(event.date).split(" ");

  const relatedEvents = events
    .filter((e) => e.id !== event.id && e.type === event.type)
    .slice(0, 3);

  const formatLabel =
    event.format === "team"
      ? "Team"
      : event.format === "both"
      ? "Individual & Team"
      : "Individual";

  return (
    <div className="min-h-screen bg-dark-darker pt-16">
      {/* ── HERO ── */}
      <section className="relative h-[600px] overflow-hidden">
        {/* Background image placeholder with brightness */}
        <div className="absolute inset-0 image-placeholder brightness-50" />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark-darker/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-darker/80 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end">
          <div className="max-w-[1440px] mx-auto px-6 pb-12 w-full">
            {/* Back link */}
            <Link
              href="/events"
              className="inline-flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6 group"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              All Events
            </Link>

            {/* Status badge + type */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`font-headline text-[10px] uppercase tracking-widest px-3 py-1.5 ${status.style}`}
              >
                {status.label}
              </span>
              <span className="font-headline text-[10px] uppercase tracking-widest text-muted">
                {typeLabel}
              </span>
              {event.isOfficial && (
                <span className="font-headline text-[10px] uppercase tracking-widest text-primary border border-primary/40 px-2 py-1">
                  Official
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-headline text-5xl sm:text-6xl lg:text-7xl font-black italic tracking-tighter text-light leading-none mb-4 max-w-4xl">
              {event.title}
            </h1>

            {/* Location + date */}
            <div className="flex flex-wrap items-center gap-6 mb-8">
              <span className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {event.location}, {stateLabel}
              </span>
              <span className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {formatEventDate(event.date)}
              </span>
            </div>

            {/* CTA */}
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-8 py-4 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
            >
              Register Now
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── SPECS BENTO ── */}
      <section className="max-w-[1440px] mx-auto px-6 py-0.5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0.5 bg-dark-darker">
          {/* Date tile */}
          <div className="bg-dark p-6">
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
              Schedule_Log
            </p>
            <p className="font-headline text-4xl font-black text-primary leading-none mb-1">
              {day}
            </p>
            <p className="font-headline text-sm font-bold uppercase tracking-wider text-light">
              {month}
            </p>
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mt-2">
              {formatTime(event.time)}
              {event.endTime && ` — ${formatTime(event.endTime)}`}
            </p>
          </div>

          {/* Format / Distance tile */}
          <div className="bg-dark p-6">
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
              Race_Config
            </p>
            <p className="font-headline text-2xl font-black italic tracking-tighter text-light mb-2 leading-tight">
              {formatLabel}
            </p>
            {event.distance && (
              <p className="font-headline text-[10px] uppercase tracking-widest text-primary">
                {event.distance}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="font-headline text-[10px] uppercase tracking-widest text-muted">
                {event.level === "elite" ? "Elite" : event.level === "beginner" ? "Beginner" : "Open"}
              </span>
            </div>
          </div>

          {/* Location tile (col-span-2) */}
          <div className="col-span-2 bg-dark p-6 border-l-4 border-primary">
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
              Location_Data
            </p>
            <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light mb-2 leading-tight">
              {event.location}
            </h3>
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-4">
              {event.city}, {stateLabel}
            </p>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.location + ", " + event.city + ", Australia")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-headline text-[10px] uppercase tracking-widest text-primary hover:underline"
              >
                View on Maps
              </a>
            </div>
          </div>

          {/* Description tile (col-span-2 lg:col-span-3) */}
          <div className="col-span-2 lg:col-span-3 bg-dark p-6">
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
              Event_Overview
            </p>
            <p className="text-muted leading-relaxed mb-4">{event.description}</p>
            <div className="flex flex-wrap gap-2">
              <span className="font-headline text-[10px] uppercase tracking-widest text-dark bg-primary px-3 py-1">
                {typeLabel}
              </span>
              <span className="font-headline text-[10px] uppercase tracking-widest text-muted border border-dark-lighter px-3 py-1">
                {formatLabel}
              </span>
              {event.isOfficial && (
                <span className="font-headline text-[10px] uppercase tracking-widest text-primary border border-primary/40 px-3 py-1">
                  Official Event
                </span>
              )}
            </div>
          </div>

          {/* Organizer / Register tile */}
          <div className="col-span-2 lg:col-span-1 bg-dark border-l-4 border-primary p-6 flex flex-col justify-between">
            <div>
              <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">
                Registration
              </p>
              {event.organizer && (
                <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-4">
                  By {event.organizer}
                </p>
              )}
            </div>
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-machined text-dark font-headline text-[10px] uppercase tracking-widest px-4 py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 mt-4"
            >
              <span>Register Now</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ── RECOMMENDED EVENTS ── */}
      {relatedEvents.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-6 py-12">
          <div className="bg-dark p-0.5">
            <div className="bg-dark px-6 py-8">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">
                    More Like This
                  </p>
                  <h2 className="font-headline text-3xl font-black italic tracking-tighter text-light">
                    Related Events
                  </h2>
                </div>
                <Link
                  href={`/events?type=${event.type}`}
                  className="hidden sm:flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors group"
                >
                  <span>All {typeLabel}</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-dark-darker">
                {relatedEvents.map((related) => {
                  const [relDay, relMonth] = formatShortDate(related.date).split(" ");
                  return (
                    <Link key={related.id} href={`/events/${related.id}`} className="group">
                      <article className="relative bg-dark overflow-hidden">
                        <div className="relative aspect-[16/9] image-placeholder grayscale group-hover:grayscale-0 transition-all duration-500">
                          <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />
                          <div className="absolute top-3 left-3">
                            <span className="font-headline text-[10px] uppercase tracking-widest bg-primary text-dark px-2 py-1">
                              {EVENT_TYPE_LABELS[related.type]}
                            </span>
                          </div>
                        </div>
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="font-headline text-lg font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight flex-1">
                              {related.title}
                            </h3>
                            <div className="bg-dark-lighter px-3 py-1 text-center ml-3 flex-shrink-0">
                              <p className="font-headline text-[9px] uppercase tracking-widest text-muted leading-none">{relMonth}</p>
                              <p className="font-headline text-lg font-black text-light leading-none">{relDay}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 font-headline text-[10px] uppercase tracking-widest text-muted">
                              <MapPin className="w-3 h-3 text-primary" />
                              {related.city}, {STATE_LABELS[related.state]}
                            </span>
                            <span className="font-headline text-[10px] uppercase tracking-widest text-primary group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex items-center gap-1">
                              View
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── BACK CTA ── */}
      <div className="max-w-[1440px] mx-auto px-6 pb-12">
        <div className="border-t border-dark-lighter pt-8 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors group"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            Back to All Events
          </Link>
          <a
            href={event.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-machined text-dark font-headline text-[10px] uppercase tracking-widest px-6 py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100"
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
  const events = eventsData.events as FitnessEvent[];
  return events.map((event) => ({ id: event.id }));
}
