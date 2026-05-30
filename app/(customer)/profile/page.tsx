"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Save, Heart, Calendar, MapPin, Clock, RefreshCw } from "lucide-react";
import type { CustomerEvent } from "@/types";
import { EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatMediumDate, formatTime } from "@/lib/utils";
import { getSavedEventIds, getRegisteredEventIds } from "@/lib/client-lists";
import { toCustomerEvents } from "@/lib/customer-events";

export default function ProfilePage() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [events, setEvents] = useState<CustomerEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setSavedIds(getSavedEventIds());
      setRegisteredIds(getRegisteredEventIds());
      const eventsRes = await fetch("/api/events");
      const eventsData = eventsRes.ok ? await eventsRes.json() : [];
      setEvents(Array.isArray(eventsData) ? toCustomerEvents(eventsData) : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (
        e.key === "startline_saved_events" ||
        e.key === "startline_registered_interest"
      ) {
        loadData();
      }
    }
    function onLocalChange() {
      loadData();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("startline-lists-changed", onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("startline-lists-changed", onLocalChange);
    };
  }, [loadData]);

  if (loading) {
    return (
      <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
        <RefreshCw className="w-6 h-6 text-muted animate-spin" />
      </main>
    );
  }

  const savedEvents = events.filter((e) => savedIds.includes(String(e.id)));
  const registeredEvents = events.filter((e) =>
    registeredIds.includes(String(e.id))
  );

  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="bg-dark border-b border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-6 pt-48 pb-12">
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-3">
            <span className="w-10 h-px bg-primary inline-block" />
            Your lists
          </p>
          <h1 className="font-headline text-3xl sm:text-4xl font-black italic tracking-tighter text-light">
            Saved &amp; registered
          </h1>
          <p className="text-muted text-sm mt-3 max-w-xl leading-relaxed">
            Saved events and interest you register are stored in this browser only &mdash; nothing is sent to an account server.
          </p>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 py-12" id="saved">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark rounded-xl p-8">
            <div className="flex items-center gap-3 mb-2">
              <Heart className="w-5 h-5 text-primary" />
              <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
                Saved Events
              </h2>
              <span className="ml-auto font-headline text-xs text-muted">{savedEvents.length}</span>
            </div>
            <p className="text-muted text-xs mb-6 leading-relaxed">
              Events you&apos;ve bookmarked with the heart icon &mdash; your personal shortlist to revisit later.
            </p>
            {savedEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted text-sm mb-3">No saved events yet.</p>
                <Link
                  href="/events"
                  className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Browse Events
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {savedEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-light transition-colors group"
                  >
                    <div className="flex-shrink-0 w-12 text-center">
                      <span className="font-headline text-[10px] uppercase tracking-widest text-primary block">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline text-sm font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-3 text-muted font-headline text-[10px] uppercase tracking-widest mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-primary" />
                          {formatMediumDate(event.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" />
                          {event.city}, {STATE_LABELS[event.state]}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-dark rounded-xl p-8">
            <div className="flex items-center gap-3 mb-2">
              <Save className="w-5 h-5 text-primary" />
              <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">
                Registered interest
              </h2>
              <span className="ml-auto font-headline text-xs text-muted">{registeredEvents.length}</span>
            </div>
            <p className="text-muted text-xs mb-6 leading-relaxed">
              Events where you tapped &quot;Register interest&quot; &mdash; stored locally in this browser. This is separate from saving a bookmark.
            </p>
            {registeredEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted text-sm mb-3">No registered interest yet.</p>
                <Link
                  href="/events"
                  className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  Browse Events
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {registeredEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-light transition-colors group"
                  >
                    <div className="flex-shrink-0 w-12 text-center">
                      <span className="font-headline text-[10px] uppercase tracking-widest text-primary block">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-headline text-sm font-bold italic tracking-tighter text-light group-hover:text-primary transition-colors truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-3 text-muted font-headline text-[10px] uppercase tracking-widest mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-primary" />
                          {formatMediumDate(event.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-primary" />
                          {formatTime(event.time)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
