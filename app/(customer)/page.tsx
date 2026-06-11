import Link from "next/link";
import { MapPin, Search, Calendar } from "lucide-react";
import { EVENT_TYPE_LABELS } from "@/types";
import { formatShortDate, truncateTitle } from "@/lib/utils";
import { getEventImage, getCategoryImage } from "@/lib/images";
import { getAllEvents } from "@/lib/events";
import { toCustomerEvents } from "@/lib/customer-events";
import HeroCarousel from "@/components/HeroCarousel";
import HeroSearch from "@/components/HeroSearch";
import { ScrollCarousel } from "@/components/ui/ScrollCarousel";
import { Button } from "@/components/ui/button";

export const revalidate = 60;

const CATEGORIES = [
  { type: "hyrox",    label: "HYROX",    description: "The World Series of Fitness Racing" },
  { type: "running",  label: "Running",  description: "5K to Ultramarathon" },
  { type: "crossfit", label: "CrossFit", description: "Functional Fitness Competitions" },
  { type: "hybrid",   label: "Hybrid",   description: "Multi-Discipline & OCR Events" },
] as const;

const EVENT_TYPE_ORDER = ["hyrox", "running", "crossfit", "hybrid"] as const;

export default async function Home() {
  const raw = await getAllEvents();
  const events = toCustomerEvents(raw);

  const categories = CATEGORIES.map((c) => ({
    ...c,
    count: events.filter((e) => e.type === c.type).length,
  }));

  return (
    <main className="min-h-screen bg-dark-darker">

      {/* ── Hero ── */}
      <section className="relative min-h-[520px] sm:min-h-[600px] flex items-end overflow-hidden">
        <HeroCarousel />
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-20 pb-8 sm:pb-12">
          <p className="font-headline text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary mb-3">
            Australia&apos;s Fitness Event Calendar
          </p>
          <h1 className="font-headline text-[44px] sm:text-6xl lg:text-8xl font-black italic leading-none tracking-tighter mb-3">
            Find Your <span className="text-primary">Start Line.</span>
          </h1>
          <p className="font-headline text-sm sm:text-base font-medium text-muted max-w-xl leading-relaxed">
            Search, filter and register for fitness events across Australia.
          </p>
          <HeroSearch />
        </div>
      </section>

      {/* ── Most Popular Events ── */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <ScrollCarousel
          eyebrow="Trending Now"
          title="Most Popular Events"
          viewAllHref="/events"
          arrowTopClass="top-[98px]"
        >
          {events.map((event) => {
            const [day, month] = formatShortDate(event.date).split(" ");
            const img = getEventImage(event.type, event.id);
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group flex-shrink-0 w-[220px] sm:w-[260px]"
                style={{ scrollSnapAlign: "start" }}
              >
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-dark mb-3 rounded-2xl sm:rounded-3xl">
                  <img
                    src={img}
                    alt={event.title}
                    className="w-full h-full object-cover brightness-75 group-hover:brightness-90 transition-all duration-500"
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-2 py-1 rounded-full">
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                  </div>
                </div>
                <div className="px-0.5">
                  <h3 className="font-headline text-sm sm:text-base font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight mb-1">
                    {truncateTitle(event.title)}
                  </h3>
                  <div className="flex items-center gap-1.5 font-headline text-[10px] sm:text-xs text-muted uppercase tracking-widest mb-0.5">
                    <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                    {event.city}, {event.state.toUpperCase()}
                  </div>
                  <div className="flex items-center gap-1.5 font-headline text-[10px] sm:text-xs text-muted uppercase tracking-widest">
                    <Calendar className="w-3 h-3 text-primary flex-shrink-0" />
                    {day} {month}
                  </div>
                  {event.ticketDrops && event.ticketDrops.length > 0 && (
                    <p className="font-headline text-xs font-bold text-light mt-1.5">
                      From {event.ticketDrops[0].price}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </ScrollCarousel>
      </section>

      {/* ── Event Categories ── */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 pb-10 sm:pb-16">
        <ScrollCarousel
          eyebrow="Browse by Discipline"
          title="Event Categories"
          arrowTopClass="top-[110px]"
        >
          {categories.map((cat) => (
            <Link
              key={cat.type}
              href={`/events?type=${cat.type}`}
              className="group flex-shrink-0 w-[180px] sm:w-[240px]"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative w-full aspect-square overflow-hidden bg-dark mb-3 rounded-2xl sm:rounded-3xl">
                <img
                  src={getCategoryImage(cat.type)}
                  alt={cat.label}
                  className="w-full h-full object-cover brightness-50 group-hover:brightness-75 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-darker/80 to-transparent" />
                <div className="absolute bottom-2.5 left-3">
                  <span className="font-headline text-[10px] sm:text-xs font-medium uppercase tracking-widest text-primary">
                    {cat.count} events
                  </span>
                </div>
              </div>
              <div className="px-0.5">
                <h3 className="font-headline text-sm sm:text-base font-black italic tracking-tighter text-light group-hover:text-primary transition-colors mb-0.5">
                  {cat.label}
                </h3>
                <p className="font-headline text-[10px] sm:text-xs text-muted tracking-wide">{cat.description}</p>
              </div>
            </Link>
          ))}
        </ScrollCarousel>
      </section>

      {/* ── By Discipline ── */}
      {EVENT_TYPE_ORDER.map((type) => {
        const typeEvents = events.filter((e) => e.type === type);
        if (typeEvents.length === 0) return null;
        return (
          <section key={type} className="max-w-[1440px] mx-auto px-4 sm:px-6 pb-10 sm:pb-14">
            <ScrollCarousel
              title={EVENT_TYPE_LABELS[type]}
              viewAllHref={`/events?type=${type}`}
              arrowTopClass="top-[83px]"
            >
              {typeEvents.map((event) => {
                const [day, month] = formatShortDate(event.date).split(" ");
                const img = getEventImage(event.type, event.id);
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="group flex-shrink-0 w-[180px] sm:w-[220px]"
                    style={{ scrollSnapAlign: "start" }}
                  >
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-dark mb-3 rounded-2xl sm:rounded-3xl">
                      <img
                        src={img}
                        alt={event.title}
                        className="w-full h-full object-cover brightness-75 group-hover:brightness-90 transition-all duration-500"
                      />
                    </div>
                    <div className="px-0.5">
                      <h3 className="font-headline text-sm font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight mb-1">
                        {truncateTitle(event.title, 24)}
                      </h3>
                      <div className="flex items-center justify-between font-headline text-[10px] sm:text-xs text-muted uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" />
                          {event.city}
                        </span>
                        <span>{day} {month}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </ScrollCarousel>
          </section>
        );
      })}

      {/* ── CTA ── */}
      <section className="bg-dark border-t border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary flex items-center gap-3 mb-4">
              <span className="w-8 h-px bg-primary inline-block" />
              Australia&apos;s Fitness Event Calendar
            </p>
            <h2 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight mb-3">
              Where is your<br />
              <span className="text-primary">next start line?</span>
            </h2>
            <p className="text-muted text-sm leading-relaxed">
              HYROX, CrossFit, running and hybrid events across Australia &mdash; all in one place.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button asChild variant="machined" size="ctaLg" className="w-full sm:w-auto justify-center">
              <Link href="/events">
                <Search className="w-4 h-4" />
                Browse Events
              </Link>
            </Button>
            <Button asChild variant="outline" size="ctaLg" className="w-full sm:w-auto justify-center">
              <Link href="/contact">List Your Event</Link>
            </Button>
          </div>
        </div>
      </section>

    </main>
  );
}
