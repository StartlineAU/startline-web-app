"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, MapPin, Calendar, Zap } from "lucide-react";
import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";
import { formatMediumDate } from "@/lib/utils";

const events = eventsData.events as FitnessEvent[];
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

export default function Home() {
  const router = useRouter();
  const [searchType, setSearchType] = useState("");
  const [searchState, setSearchState] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchType) params.set("type", searchType);
    if (searchState) params.set("state", searchState);
    router.push(`/events${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <main className="min-h-screen bg-dark-darker">
      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background image placeholder */}
        <div
          className="absolute inset-0 bg-dark opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(179,225,83,0.06) 0%, transparent 70%)",
          }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-dark-darker via-dark-darker/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-transparent to-transparent" />

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 pt-32 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-center">
            {/* Left column */}
            <div>
              {/* Status label */}
              <div className="flex items-center gap-3 mb-8">
                <Image
                  src="/images/logo-title.svg"
                  alt="StartLine"
                  width={180}
                  height={48}
                  className="h-10 w-auto"
                  priority
                />
              </div>

              <h1 className="font-headline text-6xl sm:text-7xl lg:text-8xl font-black italic leading-none tracking-tighter mb-6">
                Find Your{" "}
                <span className="text-primary block">Start Line.</span>
              </h1>

              <p className="text-muted text-lg max-w-xl mb-10 leading-relaxed">
                Australia&apos;s competitive fitness calendar. HYROX, CrossFit,
                running and hybrid events — all in one place.
              </p>

              {/* Search HUD */}
              <div className="border-l-4 border-primary bg-dark p-0.5">
                <div className="bg-dark p-6">
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-4">
                    Search Parameters
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-0.5 bg-dark-darker mb-4">
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value)}
                      className="bg-dark-light text-light font-headline text-sm uppercase tracking-wider px-4 py-3 border-0 focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="">Event Type</option>
                      <option value="hyrox">HYROX</option>
                      <option value="crossfit">CrossFit</option>
                      <option value="running">Running</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                    <select
                      value={searchState}
                      onChange={(e) => setSearchState(e.target.value)}
                      className="bg-dark-light text-light font-headline text-sm uppercase tracking-wider px-4 py-3 border-0 focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="">All States</option>
                      <option value="nsw">NSW</option>
                      <option value="vic">VIC</option>
                      <option value="qld">QLD</option>
                      <option value="wa">WA</option>
                      <option value="sa">SA</option>
                      <option value="tas">TAS</option>
                      <option value="act">ACT</option>
                      <option value="nt">NT</option>
                    </select>
                    <button
                      onClick={handleSearch}
                      className="bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
                    >
                      Execute Search
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {["HYROX", "CrossFit", "Running", "Hybrid"].map((t) => (
                      <Link
                        key={t}
                        href={`/events?type=${t.toLowerCase()}`}
                        className="font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors hover:-translate-x-0.5 hover:-translate-y-0.5 inline-block"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column — System Status */}
            <div className="hidden lg:block">
              <div className="border border-dark-lighter bg-dark p-6 space-y-6">
                <div>
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">
                    System Status
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse-dot w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                    <span className="font-headline text-sm font-bold uppercase tracking-wider text-primary">
                      Optimal
                    </span>
                  </div>
                </div>
                <div className="h-px bg-dark-lighter" />
                <div>
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-1">
                    Active Events
                  </p>
                  <p className="font-headline text-4xl font-black text-light">
                    {events.length}
                  </p>
                </div>
                <div className="h-px bg-dark-lighter" />
                <div className="space-y-2">
                  {categories.map((c) => (
                    <div key={c.type} className="flex items-center justify-between">
                      <span className="font-headline text-[10px] uppercase tracking-widest text-muted">
                        {c.label}
                      </span>
                      <span className="font-headline text-xs font-bold text-primary">
                        {c.count}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-dark-lighter" />
                <Link
                  href="/events"
                  className="flex items-center justify-between gap-2 font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors group"
                >
                  <span>Browse All Events</span>
                  <ArrowRight className="w-3 h-3 group-hover:-translate-x-0 group-hover:text-primary transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRENDING EVENTS ── */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">
              Trending Now
            </p>
            <h2 className="font-headline text-4xl font-black italic tracking-tighter text-light">
              Upcoming Events
            </h2>
          </div>
          <Link
            href="/events"
            className="hidden sm:flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted hover:text-primary transition-colors group"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-dark-darker">
          {trendingEvents.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`} className="group">
              <article className="relative aspect-[4/5] bg-dark overflow-hidden">
                {/* Image placeholder with gradient */}
                <div className="absolute inset-0 image-placeholder grayscale group-hover:grayscale-0 transition-all duration-500" />
                <div
                  className="absolute inset-0 opacity-60 group-hover:opacity-40 transition-opacity duration-500"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(179,225,83,0.08) 0%, transparent 60%)",
                  }}
                />
                {/* Bottom gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-darker via-dark/60 to-transparent" />

                {/* Type badge */}
                <div className="absolute top-4 left-4">
                  <span className="font-headline text-[10px] uppercase tracking-widest text-dark bg-primary px-2 py-1">
                    {event.type.toUpperCase()}
                  </span>
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p className="font-headline text-[10px] uppercase tracking-widest text-primary mb-2">
                    {formatMediumDate(event.date)}
                  </p>
                  <h3 className="font-headline text-2xl font-black italic tracking-tighter text-light mb-1 leading-tight">
                    {event.title}
                  </h3>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-headline text-[10px] uppercase tracking-widest text-muted flex items-center gap-1">
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
          <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">
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
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">
                    {categories[0].count} Events
                  </p>
                  <h3 className="font-headline text-5xl font-black italic tracking-tighter text-light group-hover:text-primary transition-colors duration-200">
                    {categories[0].label}
                  </h3>
                  <p className="text-muted text-sm mt-2">
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
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted">
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
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-4">
              Data Driven
            </p>
            <h2 className="font-headline text-4xl sm:text-5xl font-black italic tracking-tighter text-light mb-4">
              Never Miss a Race.
            </h2>
            <p className="text-muted max-w-lg mx-auto mb-8">
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
                <span className="font-headline text-[10px] uppercase tracking-widest text-muted">
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
