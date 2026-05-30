"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ArrowRight, MapPin } from "lucide-react";
import OrganiserTopBar from "@/components/organiser/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; startTime: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null; registrationCount?: number | null; registrationUrl?: string | null;
}

function formatEventDate(dateStr: string, startTime: string) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const time = startTime
      ? new Date(`1970-01-01T${startTime}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()
      : null;
    return time ? `${day} · ${time}` : day;
  } catch {
    return dateStr;
  }
}

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; label: string }> = {
  DRAFT:    { bg: "bg-gray-200",  text: "text-gray-700",  label: "Draft"    },
  PENDING:  { bg: "bg-blue-200",  text: "text-blue-900",  label: "Pending"  },
  APPROVED: { bg: "bg-lime-200",  text: "text-lime-900",  label: "Live"     },
  REJECTED: { bg: "bg-red-200",   text: "text-red-900",   label: "Rejected" },
  ARCHIVED: { bg: "bg-gray-200",  text: "text-gray-500",  label: "Archived" },
};

function StatCard({
  label, value, sub, trend, good, delay = 0,
}: { label: string; value: string | number; sub: string; trend?: string; good?: boolean; delay?: number }) {
  return (
    <Card
      className="hover:shadow-sm transition-shadow stagger-item"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-6">
        <div className="font-headline text-[11px] uppercase tracking-widest text-gray-900 mb-3">{label}</div>
        <div className="font-headline text-5xl font-black italic tracking-tighter text-gray-900 mb-3">{value}</div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-gray-900">{sub}</span>
          {trend && (
            <span className={`font-headline text-[11px] uppercase tracking-widest ${good ? "text-lime-600" : "text-gray-700"}`}>
              {trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


export default function DashboardPage() {
  const router = useRouter();
  const [events,  setEvents]  = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organiser/events")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setEvents(d); })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({
    live:          events.filter(e => e.status === "APPROVED").length,
    total:         events.length,
    registrations: events.reduce((sum, e) => sum + (e.registrationCount ?? 0), 0),
  }), [events]);

  const recent = events.filter(e => e.status !== "ARCHIVED").slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-16">
        <div className="max-w-[1200px] mx-auto px-6 py-10 pb-24 lg:pb-12 page-in">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-3">
                Welcome back
              </div>
              <h1 className="font-headline text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none text-gray-900">
                Hi there.<br /><span className="text-lime-500">Here's your day.</span>
              </h1>
              <p className="text-gray-900 mt-4 max-w-xl text-[15px]">
                {loading
                  ? "Loading your events…"
                  : stats.live > 0
                  ? `${stats.live} event${stats.live !== 1 ? "s" : ""} live and taking registrations.`
                  : events.length === 0
                  ? "No events yet. Create your first listing to get started."
                  : "No live events right now. Submit a draft to go live."}
              </p>
            </div>
            <Button asChild size="lg" className="self-start lg:self-end">
              <Link href="/organiser/listings">
                <CalendarDays className="w-4 h-4" /> View my events
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <StatCard label="Events live now"  value={loading ? "—" : stats.live}          sub={`of ${stats.total} total`} good trend={stats.live > 0 ? "Taking sign-ups" : undefined} delay={0}   />
            <StatCard label="Registrations"    value={loading ? "—" : stats.registrations} sub="across all events"          good={stats.registrations > 0}                         delay={80}  />
            <StatCard label="Total events"     value={loading ? "—" : stats.total}         sub="all time"                                                                           delay={160} />
          </div>

          {/* Recent events */}
          <section className="stagger-item" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900">Your upcoming events</h2>
              <Link href="/organiser/listings" className="font-headline text-[11px] uppercase tracking-widest text-gray-700 hover:text-gray-900 flex items-center gap-1 transition-colors">
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <Card className="overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 font-headline font-bold text-[12px] uppercase tracking-widest text-gray-900">
                <div className="col-span-5">Event</div>
                <div className="col-span-2 text-center">Date</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-3">Registered / Cap</div>
              </div>

              {loading && (
                <div className="p-10 text-center">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                  <div className="font-headline text-sm text-gray-700 uppercase tracking-widest">Loading…</div>
                </div>
              )}

              {!loading && recent.length === 0 && (
                <div className="p-10 text-center">
                  <div className="font-headline text-lg font-black italic text-gray-900 mb-1">Nothing here yet</div>
                  <div className="text-gray-700 text-sm mb-5">Create your first listing to get started.</div>
                  <Button asChild>
                    <Link href="/organiser/new-listing">
                      <CalendarDays className="w-4 h-4" /> Add new listing
                    </Link>
                  </Button>
                </div>
              )}

              {!loading && recent.map((e, i) => {
                const s     = STATUS_STYLE[e.status];
                const price = (e.waves as { price: string }[])?.[0]?.price;
                return (
                  <div key={e.id}
                    onClick={() => router.push(e.status === "APPROVED" ? `/organiser/events/${e.id}/dashboard` : `/organiser/events/${e.id}`)}
                    className={`grid grid-cols-12 gap-4 px-5 py-4 items-center cursor-pointer hover:bg-lime-50 hover:border-l-2 hover:border-l-lime-400 transition-all ${i < recent.length - 1 ? "border-b border-gray-100" : ""}`}>

                    <div className="col-span-5 flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {e.coverImageUrl
                          ? <img src={e.coverImageUrl} alt={e.title} className="w-full h-full object-cover" />
                          : <div className="font-mono text-[9px] text-gray-700 uppercase">{e.discipline.slice(0, 4)}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="font-headline text-[15px] font-black italic tracking-tighter text-gray-900">{e.title}</div>
                        <div className="flex items-center gap-1 font-headline text-[11px] text-gray-700 uppercase tracking-widest mt-0.5">
                          <MapPin className="w-3 h-3 text-lime-500" /> {e.city}, {e.state.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-center">
                      <div className="font-headline text-sm font-bold text-gray-900">{formatEventDate(e.eventDate, e.startTime)}</div>
                    </div>

                    <div className="col-span-2 flex justify-center">
                      <Badge className={`${s.bg} ${s.text} border-0`}>
                        {s.label}
                      </Badge>
                    </div>

                    <div className="col-span-3">
                      <div className="font-headline text-sm font-bold text-gray-900">
                        {(e.registrationCount ?? 0).toLocaleString()}
                        {e.cap ? <span className="text-gray-400 font-normal"> / {e.cap.toLocaleString()}</span> : <span className="text-gray-400 font-normal"> / —</span>}
                      </div>
                      {price && <div className="font-headline text-[10px] uppercase tracking-widest text-gray-700 mt-0.5">from A${price}</div>}
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}

