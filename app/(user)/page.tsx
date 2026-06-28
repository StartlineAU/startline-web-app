import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";
import { EVENT_TYPE_LABELS } from "@/types";
import { formatShortDate, truncateTitle } from "@/lib/utils";
import { getEventImage } from "@/lib/images";
import { getAllEvents } from "@/lib/events";
import { toUserEvents } from "@/lib/user-events";
import { getUserSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import HeroCarousel from "@/components/HeroCarousel";
import HeroSearch from "@/components/HeroSearch";
import { ScrollCarousel } from "@/components/ui/ScrollCarousel";
import type { UserEvent } from "@/types";

export const revalidate = 60;

function EventCard({ event }: { event: UserEvent }) {
  const [day, month] = formatShortDate(event.date).split(" ");
  const img = getEventImage(event.type, event.id);
  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex-shrink-0 w-[240px] sm:w-[280px]"
      style={{ scrollSnapAlign: "start" }}
    >
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-dark rounded-2xl sm:rounded-3xl">
        <img
          src={img}
          alt={event.title}
          className="w-full h-full object-cover brightness-[0.55] group-hover:brightness-[0.7] group-hover:scale-105 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker/90 via-dark-darker/20 to-transparent" />

        <div className="absolute top-3 right-3 bg-dark/80 backdrop-blur-sm rounded-xl px-3 py-2 text-center leading-tight">
          <span className="block font-headline text-lg font-black text-primary">{day}</span>
          <span className="block font-headline text-[9px] font-bold uppercase tracking-widest text-light/70">{month}</span>
        </div>

        <div className="absolute top-3 left-3">
          <span className="font-headline text-[9px] font-bold uppercase tracking-widest bg-primary text-dark px-2.5 py-1 rounded-full">
            {EVENT_TYPE_LABELS[event.type]}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-headline text-base sm:text-lg font-black italic tracking-tighter text-light group-hover:text-primary transition-colors leading-tight mb-1.5 line-clamp-2">
            {truncateTitle(event.title)}
          </h3>
          <div className="flex items-center gap-1.5 font-headline text-[10px] text-muted uppercase tracking-widest mb-1">
            <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
            {event.city}, {event.state.toUpperCase()}
          </div>
          {event.ticketDrops && event.ticketDrops.length > 0 && (
            <div className="inline-block mt-1.5 bg-primary/15 backdrop-blur-sm rounded-lg px-3 py-1">
              <span className="font-headline text-[11px] font-bold text-primary">From ${event.ticketDrops[0].price}</span>
            </div>
          )}
        </div>

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute -inset-full top-0 h-full w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:animate-shimmer" />
        </div>
      </div>
    </Link>
  );
}

function sortByDate(events: UserEvent[]): UserEvent[] {
  return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default async function Home() {
  const raw = await getAllEvents();
  const events = toUserEvents(raw);

  // ── Starting Soon (next upcoming events) ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = sortByDate(events.filter((e) => new Date(e.date) >= today));
  const startingSoon = upcoming.slice(0, 12);

  // ── Recommended For You ──
  let recommended = events;
  try {
    const session = await getUserSession();
    if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { city: true, state: true },
      });
      if (user?.state) {
        const local = events.filter((e) => e.state === user.state);
        if (local.length >= 3) recommended = local;
      }
    }
  } catch {
    // not authenticated — show all
  }

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

      {/* ── Trending Now ── */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-6 sm:pb-8">
        <ScrollCarousel
          eyebrow="Trending Now"
          title="Most Popular Events"
        >
          {events.map((event) => <EventCard key={event.id} event={event} />)}
        </ScrollCarousel>
      </section>

      {/* ── Starting Soon ── */}
      {startingSoon.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <ScrollCarousel
            eyebrow="Coming Up"
            title="Starting Soon"
          >
            {startingSoon.map((event) => <EventCard key={event.id} event={event} />)}
          </ScrollCarousel>
        </section>
      )}

      {/* ── Recommended For You ── */}
      {recommended.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-16 sm:pb-20">
          <ScrollCarousel
            eyebrow="Personalised"
            title="Recommended For You"
          >
            {recommended.map((event) => <EventCard key={event.id} event={event} />)}
          </ScrollCarousel>
        </section>
      )}

    </main>
  );
}
