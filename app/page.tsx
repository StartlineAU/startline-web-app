import Hero from "@/components/Hero";
import EventCard from "@/components/EventCard";
import eventsData from "@/data/events.json";
import { FitnessEvent, EVENT_TYPE_OPTIONS, STATE_OPTIONS } from "@/types";
import { getUpcomingEvents, getEventsByType, getEventsByState, getTotalUpcomingEvents } from "@/lib/utils";
import { ArrowRight, Calendar, MapPin, Trophy, Flag } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const events = eventsData.events as FitnessEvent[];
  const upcomingEvents = getUpcomingEvents(events, 6);
  const eventsByType = getEventsByType(events);
  const eventsByState = getEventsByState(events);
  const totalEvents = getTotalUpcomingEvents(events);

  return (
    <div className="bg-dark-darker">
      {/* Hero Section */}
      <Hero />

      {/* Upcoming Competitions */}
      <section className="py-12 border-t border-dark-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Upcoming Competitions
                </h2>
                <p className="text-sm text-muted">Sorted by date</p>
              </div>
            </div>
            <Link
              href="/events"
              className="hidden sm:flex items-center gap-2 text-primary font-medium hover:underline text-sm"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          <div className="mt-6 text-center sm:hidden">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 bg-dark-light text-white px-6 py-3 rounded font-medium hover:bg-primary hover:text-dark transition-colors"
            >
              View All Competitions
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Browse by Event Type */}
      <section className="py-12 bg-dark border-t border-dark-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Browse by Event Type
              </h2>
              <p className="text-sm text-muted">
                Find competitions in your discipline
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {EVENT_TYPE_OPTIONS.map((type) => (
              <Link
                key={type.value}
                href={`/events?type=${type.value}`}
                className="bg-dark-darker border border-dark-light rounded-lg p-5 hover:border-primary transition-colors group"
              >
                <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                  {type.shortLabel}
                </h3>
                <p className="text-sm text-muted mt-1">
                  {eventsByType[type.value] || 0} events
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by State */}
      <section className="py-12 border-t border-dark-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Browse by State</h2>
              <p className="text-sm text-muted">Events across Australia</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {STATE_OPTIONS.map((state) => (
              <Link
                key={state.value}
                href={`/events?state=${state.value}`}
                className={`bg-dark border border-dark-light rounded-lg p-4 text-center hover:border-primary transition-colors group ${
                  eventsByState[state.value] === 0 ? "opacity-50" : ""
                }`}
              >
                <p className="font-semibold text-white group-hover:text-primary transition-colors">
                  {state.shortLabel}
                </p>
                <p className="text-xs text-muted mt-1">
                  {eventsByState[state.value] || 0}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-8 bg-dark border-t border-dark-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-6 text-sm text-muted">
              <span className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-primary" />
                <span>
                  <span className="font-semibold text-white">{totalEvents}</span>{" "}
                  competitions listed
                </span>
              </span>
              <span className="hidden sm:inline text-dark-lighter">·</span>
              <span className="hidden sm:inline">Updated weekly</span>
            </div>
            <Link
              href="/submit"
              className="text-sm text-muted hover:text-primary transition-colors"
            >
              Are you an event organizer? Submit an event →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
