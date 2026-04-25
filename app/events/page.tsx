import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ArrowRight, Calendar } from "lucide-react";
import { fetchAllEvents } from "@/lib/supabase";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { getEventStatus } from "@/lib/event-status";
import { formatShortDate } from "@/lib/utils";
import { getEventImage } from "@/lib/images";

export const metadata: Metadata = {
  title: "Events — Fitness Competitions Across Australia",
  description:
    "Browse upcoming HYROX, CrossFit, running and hybrid fitness events across Australia. Filter by state, discipline and format to find the perfect competition.",
  alternates: { canonical: "/events" },
  openGraph: {
    title:       "Fitness Events in Australia | Startline",
    description: "Browse upcoming HYROX, CrossFit, running and hybrid fitness events across Australia.",
    url:         "https://www.startlineau.com/events",
  },
};

// Revalidate every 5 minutes so new approved events appear quickly
export const revalidate = 300;

const TYPE_COLORS: Record<FitnessEvent["type"], string> = {
  hyrox:    "bg-primary/15 text-primary border-primary/30",
  crossfit: "bg-blue-900/30 text-blue-400 border-blue-400/30",
  running:  "bg-orange-900/30 text-orange-400 border-orange-400/30",
  hybrid:   "bg-purple-900/30 text-purple-400 border-purple-400/30",
};

function EventCard({ event }: { event: FitnessEvent }) {
  const status    = getEventStatus(event);
  const img       = getEventImage(event.type, event.id, 600, 80);
  const [day, month] = formatShortDate(event.date).split(" ");
  const typeLabel = EVENT_TYPE_LABELS[event.type];

  return (
    <Link href={`/events/${event.id}`}
      className="group block bg-dark border border-dark-lighter rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-[0_0_0_1px_rgb(179,225,83,0.15)] transition-all duration-200">
      {/* Thumbnail */}
      <div className="relative h-44 overflow-hidden bg-dark-light">
        <img
          src={img}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`inline-flex items-center font-headline text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${TYPE_COLORS[event.type]}`}>
            {typeLabel}
          </span>
          {event.isOfficial && (
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary">
              Official
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 text-right">
          <div className="font-headline text-[10px] uppercase tracking-widest text-muted/80">{month}</div>
          <div className="font-headline text-2xl font-black italic leading-none text-light">{day}</div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <h2 className="font-headline text-[17px] font-black italic tracking-tighter text-light leading-tight mb-2 group-hover:text-primary transition-colors">
          {event.title}
        </h2>
        <div className="flex items-center gap-1.5 font-headline text-[11px] uppercase tracking-widest text-muted mb-3">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          {event.city}, {STATE_LABELS[event.state]}
        </div>
        <p className="text-[13px] text-muted leading-relaxed line-clamp-2 mb-4">{event.description}</p>
        <div className="flex items-center justify-between pt-3 border-t border-dark-lighter">
          <span className={`font-headline text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${status.style}`}>
            {status.label}
          </span>
          <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted group-hover:text-primary flex items-center gap-1 transition-colors">
            View event <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function EventsPage() {
  const events = await fetchAllEvents();
  const now    = new Date();

  const upcoming = events.filter(e => new Date(e.date) >= now);
  const past     = events.filter(e => new Date(e.date) < now);

  // Structured data for Google
  const jsonLd = {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    name:       "Fitness Events in Australia",
    url:        "https://www.startlineau.com/events",
    numberOfItems: upcoming.length,
    itemListElement: upcoming.slice(0, 10).map((e, i) => ({
      "@type":    "ListItem",
      position:   i + 1,
      url:        `https://www.startlineau.com/events/${e.id}`,
      name:       e.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-dark-darker">
        {/* Header */}
        <header className="relative overflow-hidden border-b border-dark-lighter">
          <div className="absolute inset-0 hero-topo" />
          <div className="absolute inset-0 scan-grid opacity-30" />
          <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-primary" /> Australia&apos;s fitness calendar
            </div>
            <h1 className="font-headline text-4xl sm:text-5xl lg:text-7xl font-black italic tracking-tighter leading-none mb-4">
              Find your next<br /><span className="text-primary">competition.</span>
            </h1>
            <p className="text-muted text-[15px] lg:text-[17px] max-w-xl leading-relaxed">
              {upcoming.length} upcoming event{upcoming.length !== 1 ? "s" : ""} across Australia — HYROX, CrossFit, running and hybrid fitness.
            </p>
            {/* Mobile CTA */}
            <a
              href="#upcoming"
              className="mt-6 inline-flex items-center gap-2 sm:hidden bg-primary text-dark font-headline font-black italic text-[14px] uppercase tracking-widest px-5 py-3 rounded-md"
            >
              Browse {upcoming.length} events <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </header>

        <main id="upcoming" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="font-headline text-2xl font-black italic tracking-tighter text-light">Upcoming Events</h2>
                <span className="font-headline text-[11px] uppercase tracking-widest text-muted px-2.5 py-1 rounded-full bg-dark-lighter">{upcoming.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {upcoming.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-8">
                <h2 className="font-headline text-xl font-black italic tracking-tighter text-muted">Past Events</h2>
                <span className="font-headline text-[11px] uppercase tracking-widest text-muted-dark px-2.5 py-1 rounded-full bg-dark-lighter">{past.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 opacity-60">
                {past.slice(0, 8).map(e => <EventCard key={e.id} event={e} />)}
              </div>
            </section>
          )}

          {events.length === 0 && (
            <div className="py-32 text-center">
              <div className="font-headline text-2xl font-black italic text-light mb-2">No events yet</div>
              <div className="text-muted">Check back soon — events are added weekly.</div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
