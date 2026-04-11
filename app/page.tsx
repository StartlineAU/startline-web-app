import Link from "next/link";
import { ArrowRight, MapPin, Zap } from "lucide-react";
import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";
import { formatMediumDate } from "@/lib/utils";
import HeroCarousel from "@/components/HeroCarousel";
import HeroSearch from "@/components/HeroSearch";
import { fetchAllEvents } from "@/lib/supabase";

export const revalidate = 60;

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
  return pool[id.charCodeAt(id.length - 1) % pool.length];
}

export default async function Home() {
  const liveEvents = await fetchAllEvents();
  const events: FitnessEvent[] = liveEvents.length > 0
    ? liveEvents
    : (eventsData.events as FitnessEvent[]);

  const trendingEvents = events.slice(0, 3);

  const categories = [
    {
      label: "HYROX",
      description: "The World Series of Fitness Racing",
      type: "hyrox",
      count: events.filter((e) => e.type === "hyrox").length,
      large: true,
    },
    {
      label: "RUNNING",
      description: "5K to Ultramarathon",
      type: "running",
      count: events.filter((e) => e.type === "running").length,
      large: false,
    },
    {
      label: "CROSSFIT",
      description: "Functional Fitness Competitions",
      type: "crossfit",
      count: events.filter((e) => e.type === "crossfit").length,
      large: false,
    },
    {
      label: "HYBRID",
      description: "Multi-Discipline Events",
      type: "hybrid",
      count: events.filter((e) => e.type === "hybrid").length,
      large: false,
    },
  ];

  return (
    <main className="min-h-screen bg-dark-darker">
      {/* ── HERO ── */}
      <section className="relative min-h-[560px] flex items-end overflow-hidden">
        <HeroCarousel />

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 pt-48 pb-16">
          {/* Eyebrow */}
          <p className="font-headline text-xs font-black uppercase tracking-widest text-primary mb-4">
            Australia&apos;s Fitness Event Calendar
          </p>

          {/* Headline */}
          <h1 className="font-headline text-6xl sm:text-7xl lg:text-8xl font-black italic leading-none tracking-tighter mb-4">
            Find Your{" "}
            <span className="text-primary">Start Line.</span>
          </h1>

          {/* Sub-headline */}
          <p className="font-headline text-base font-medium text-muted max-w-2xl leading-relaxed mb-0">
            HYROX, CrossFit, running and hybrid events — search, filter, and register in seconds.
          </p>

          {/* Search bar */}
          <HeroSearch />
        </div>
      </section>

      {/* ── TRENDING EVENTS ── */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">
              Trending Now
            </p>
            <h2 className="font-headline text-4xl font-black italic tracking-tighter text-light">
              Upcoming Events
            </h2>
          </div>
          <Link
            href="/events"
            className="hidden sm:flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors group"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-dark-darker">
          {trendingEvents.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`} className="group">
              <article className="relative aspect-[4/5] bg-dark overflow-hidden ring-1 ring-transparent group-hover:ring-primary transition-all duration-200">
                {/* Real image — grayscale until hover */}
                <img
                  src={getBannerImage(event.type, event.id)}
                  alt={event.title}
                  className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 brightness-50 group-hover:brightness-60 transition-all duration-500"
                />
                {/* Bottom gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark/60 to-transparent" />

                {/* Type badge */}
                <div className="absolute top-4 left-4">
                  <span className="font-headline text-xs font-medium uppercase tracking-widest text-dark bg-primary px-2 py-1">
                    {event.type.toUpperCase()}
                  </span>
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-2">
                    {formatMediumDate(event.date)}
                  </p>
                  <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-200 mb-1 leading-tight">
                    {event.title}
                  </h3>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.city}, {event.state.toUpperCase()}
                    </span>
                    <span className="text-primary group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* ── PERFORMANCE CATEGORIES ── */}
      <section className="max-w-[1440px] mx-auto px-6 pb-20">
        <div className="mb-8">
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">
            Browse by Discipline
          </p>
          <h2 className="font-headline text-4xl font-black italic tracking-tighter text-light">
            Performance Categories
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0.5 bg-dark-darker">
          {/* Large HYROX tile */}
          <Link
            href="/events?type=hyrox"
            className="col-span-2 row-span-2 group"
          >
            <div className="relative h-64 lg:h-full min-h-64 bg-dark border-l-4 border-primary overflow-hidden">
              <div className="absolute inset-0 image-placeholder opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/40 to-transparent" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                {/* HUD corners */}
                <div className="flex justify-between">
                  <div className="w-6 h-6 hud-corner-tl" />
                  <div className="w-6 h-6 hud-corner-tr" />
                </div>
                <div>
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">
                    {categories[0].count} Events
                  </p>
                  <h3 className="font-headline text-5xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-200">
                    {categories[0].label}
                  </h3>
                  <p className="text-sm font-medium text-muted mt-2">
                    {categories[0].description}
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-primary group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-100">
                    <span className="font-headline text-[10px] uppercase tracking-widest">
                      Explore
                    </span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 hud-corner-bl" />
                  <div className="w-6 h-6 hud-corner-br" />
                </div>
              </div>
            </div>
          </Link>

          {/* Smaller tiles */}
          {categories.slice(1).map((cat) => (
            <Link key={cat.type} href={`/events?type=${cat.type}`} className="group">
              <div className="relative h-32 bg-dark overflow-hidden">
                <div className="absolute inset-0 image-placeholder opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                <div className="absolute inset-0 bg-gradient-to-br from-dark via-dark/80 to-transparent" />
                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                    {cat.count} events
                  </p>
                  <div>
                    <h3 className="font-headline text-xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-200">
                      {cat.label}
                    </h3>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── TRAINING HUD CTA ── */}
      <section className="max-w-[1440px] mx-auto px-6 pb-20">
        <div className="relative bg-dark border border-dark-lighter overflow-hidden">
          {/* HUD corners */}
          <div className="absolute top-4 left-4 w-8 h-8 hud-corner-tl" />
          <div className="absolute top-4 right-4 w-8 h-8 hud-corner-tr" />
          <div className="absolute bottom-4 left-4 w-8 h-8 hud-corner-bl" />
          <div className="absolute bottom-4 right-4 w-8 h-8 hud-corner-br" />

          <div className="px-12 py-16 text-center">
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-4">
              Data Driven
            </p>
            <h2 className="font-headline text-4xl sm:text-5xl font-black italic tracking-tighter text-light mb-4">
              Never Miss a Race.
            </h2>
            <p className="text-sm font-medium text-muted max-w-lg mx-auto mb-8">
              Australia&apos;s most comprehensive fitness event database. Updated
              in real-time. No event left behind.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/events"
                className="bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-8 py-4 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Browse All Events
              </Link>
              <div className="flex items-center gap-3">
                <span className="animate-pulse-dot w-2 h-2 rounded-full bg-primary inline-block" />
                <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                  {events.length} Active Events
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
