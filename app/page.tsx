import Hero from "@/components/Hero";
import PopularNow from "@/components/PopularNow";
import EventCard from "@/components/EventCard";
import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";
import { getPopularEvents, getUpcomingEvents } from "@/lib/utils";
import { Calendar, ArrowRight, Users, MapPin, Star } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const events = eventsData.events as FitnessEvent[];
  const popularEvents = getPopularEvents(events, 6);
  const upcomingEvents = getUpcomingEvents(events, 3);

  return (
    <div className="bg-light">
      {/* Hero Section */}
      <Hero />

      {/* Popular Now Section */}
      <PopularNow events={popularEvents} />

      {/* Featured Event Section */}
      {upcomingEvents.length > 0 && (
        <section className="py-16 bg-light">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Star className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-dark">
                    Featured Event
                  </h2>
                  <p className="text-muted text-sm">Don&apos;t miss out!</p>
                </div>
              </div>
            </div>

            <EventCard event={upcomingEvents[0]} variant="featured" />
          </div>
        </section>
      )}

      {/* Upcoming Events Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark">Upcoming Events</h2>
                <p className="text-muted text-sm">
                  Events happening soon near you
                </p>
              </div>
            </div>
            <Link
              href="/events"
              className="hidden sm:flex items-center gap-2 text-primary font-medium hover:underline"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 bg-dark text-white px-6 py-3 rounded-lg font-medium hover:bg-primary hover:text-dark transition-colors"
            >
              View All Events
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <p className="text-3xl font-bold text-white mb-1">500+</p>
              <p className="text-muted">Events Monthly</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-7 h-7 text-primary" />
              </div>
              <p className="text-3xl font-bold text-white mb-1">50+</p>
              <p className="text-muted">Cities</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <p className="text-3xl font-bold text-white mb-1">10K+</p>
              <p className="text-muted">Active Users</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Star className="w-7 h-7 text-primary" />
              </div>
              <p className="text-3xl font-bold text-white mb-1">4.9</p>
              <p className="text-muted">User Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">
            Ready to Get Moving?
          </h2>
          <p className="text-dark/70 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of fitness enthusiasts who have found their perfect
            workout through StartingLine. Your next fitness adventure awaits!
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 bg-dark text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-dark-light transition-colors"
          >
            Browse All Events
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
