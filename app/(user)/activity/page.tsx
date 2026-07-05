"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { UserEvent } from "@/types";
import { getSavedEventIds, getRegisteredEventIds } from "@/lib/client-lists";
import { toUserEvents } from "@/lib/user-events";
import EventCard from "@/components/EventCard";

function RegisteredCard({ event }: { event: UserEvent }) {
  return (
    <div className="flex flex-col">
      <EventCard
        event={event}
        cardClassName="rounded-b-none border-b-0 group-hover:ring-0"
      />
      <div
        className="bg-dark-light border border-dark-lighter rounded-b-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{ borderTopStyle: "dashed" }}
      >
        <div className="min-w-0">
          <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
            Your Wave
          </p>
          <p className="font-headline text-[12px] font-bold uppercase tracking-widest text-light mt-1 truncate">
            —
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark leading-none">
            Bib
          </p>
          <p className="font-headline text-[13px] font-black italic text-muted-dark mt-1">
            —
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: "registered" | "saved" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="font-headline text-xl font-black italic tracking-tighter text-light">
        Nothing here yet.
      </p>
      <p className="font-headline text-sm text-muted text-center max-w-xs leading-relaxed">
        {tab === "registered"
          ? "Register your interest in events to see them here."
          : "Save events with the heart icon to find them later."}
      </p>
      <Link
        href="/events"
        className="mt-2 font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
      >
        Browse Events
      </Link>
    </div>
  );
}

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<"registered" | "saved">("registered");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      setSavedIds(getSavedEventIds());
      setRegisteredIds(getRegisteredEventIds());
      const eventsRes = await fetch("/api/events");
      const eventsData = eventsRes.ok ? await eventsRes.json() : [];
      setEvents(Array.isArray(eventsData) ? toUserEvents(eventsData) : []);
    } catch {
      // silent
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "startline_saved_events" || e.key === "startline_registered_interest") {
        loadEvents();
      }
    }
    function onLocalChange() { loadEvents(); }
    window.addEventListener("storage", onStorage);
    window.addEventListener("startline-lists-changed", onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("startline-lists-changed", onLocalChange);
    };
  }, [loadEvents]);

  const savedEvents = events.filter((e) => savedIds.includes(String(e.id)));
  const registeredEvents = events.filter((e) => registeredIds.includes(String(e.id)));
  const tabEvents = activeTab === "registered" ? registeredEvents : savedEvents;

  return (
    <main className="min-h-screen bg-dark-darker">
      <div className="max-w-[1440px] mx-auto px-6 pt-20 pb-16">

        {/* Page header */}
        <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
          <div>
            <p className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2.5">
              Your Activity
            </p>
            <h1 className="font-headline text-5xl sm:text-[52px] font-black italic tracking-tighter text-light leading-none">
              Your race<br /><span className="text-primary">calendar.</span>
            </h1>
            <p className="font-headline text-[15px] text-muted max-w-[460px] leading-relaxed mt-4">
              Everything you&apos;ve entered and everything you&apos;ve saved. Keep your start lines in one place.
            </p>
          </div>
          <Link
            href="/events"
            className="inline-flex items-center h-[46px] px-6 rounded-xl bg-machined text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all duration-150 flex-shrink-0"
          >
            Find Events
          </Link>
        </div>

        {/* KPI strip */}
        <div className="flex gap-4 flex-wrap mb-9">
          {[
            { n: registeredEvents.length, l: "Registered" },
            { n: savedEvents.length, l: "Saved" },
            { n: 0, l: "Completed" },
          ].map(({ n, l }) => (
            <div
              key={l}
              className="flex-1 min-w-[140px] bg-dark border border-dark-lighter rounded-xl"
              style={{ padding: "18px 20px" }}
            >
              <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">{l}</p>
              <p className="font-headline text-[34px] font-black italic tracking-tighter text-light leading-none mt-2">
                {n}
              </p>
            </div>
          ))}
        </div>

        {/* Tab pills */}
        <div className="flex gap-2.5 mb-6">
          {(["registered", "saved"] as const).map((id) => {
            const on = activeTab === id;
            const count = id === "registered" ? registeredEvents.length : savedEvents.length;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 px-[18px] py-2.5 rounded-full font-headline text-[12px] font-bold uppercase tracking-widest transition-all duration-150 ${
                  on
                    ? "bg-primary/10 border border-primary/40 text-primary"
                    : "bg-transparent border border-dark-lighter text-muted hover:text-light"
                }`}
              >
                {id}
                <span
                  className={`font-headline text-[11px] font-bold ${on ? "text-primary" : "text-muted-dark"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {eventsLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : tabEvents.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
          >
            {activeTab === "registered"
              ? registeredEvents.map((event) => (
                  <RegisteredCard key={event.id} event={event} />
                ))
              : savedEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
          </div>
        )}
      </div>
    </main>
  );
}
