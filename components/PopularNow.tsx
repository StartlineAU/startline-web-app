"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  MapPin,
  Image,
  Flame,
} from "lucide-react";
import { FitnessEvent, EVENT_TYPE_LABELS } from "@/types";
import { formatShortDate, formatTime } from "@/lib/utils";

interface PopularNowProps {
  events: FitnessEvent[];
}

export default function PopularNow({ events }: PopularNowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (events.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-dark">Popular Now</h2>
              <p className="text-muted text-sm">
                Trending events in your area
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => scroll("left")}
              className="p-2 rounded-lg bg-light hover:bg-light-dark transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 text-dark" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="p-2 rounded-lg bg-light hover:bg-light-dark transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 text-dark" />
            </button>
          </div>
        </div>

        {/* Scrollable Events */}
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
        >
          {events.map((event, index) => (
            <article
              key={event.id}
              className="flex-shrink-0 w-[300px] bg-light rounded-2xl overflow-hidden group hover:shadow-lg transition-all duration-300"
            >
              {/* Image Placeholder with Rank */}
              <div className="relative aspect-[4/3] image-placeholder overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Image className="w-10 h-10 text-muted mx-auto mb-2" />
                    <p className="text-muted text-sm">Event Photo</p>
                  </div>
                </div>

                {/* Rank Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-dark/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">#{index + 1}</span>
                </div>

                {/* Popularity Indicator */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted">Popularity</span>
                      <span className="font-semibold text-primary">
                        {event.popularity}%
                      </span>
                    </div>
                    <div className="w-full bg-light-dark rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${event.popularity}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Type Badge */}
                <span className="inline-block text-xs font-medium bg-primary text-dark px-2.5 py-1 rounded-full mb-2">
                  {EVENT_TYPE_LABELS[event.type]}
                </span>

                <h3 className="font-semibold text-dark mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                  {event.title}
                </h3>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>
                      {formatShortDate(event.date)} at {formatTime(event.time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="truncate">{event.area}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-light-dark">
                  <span className="font-bold text-dark">{event.price}</span>
                  <button className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                    View Event
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* View All Link */}
        <div className="mt-8 text-center">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 bg-dark text-white px-6 py-3 rounded-lg font-medium hover:bg-primary hover:text-dark transition-colors duration-200"
          >
            View All Events
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
