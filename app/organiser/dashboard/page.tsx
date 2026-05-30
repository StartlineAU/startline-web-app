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

const STATUS_ORDER: Record<EventStatus, number> = {
  APPROVED: 0,
  PENDING:  1,
  REJECTED: 2,
  DRAFT:    3,
  ARCHIVED: 4,
};

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; startTime: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null; registrationCount: number; registrationUrl?: string | null;
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
  DRAFT:    { bg: "bg-gray-200",  text: "text-gray-700",  label: "Draft"      },
  PENDING:  { bg: "bg-blue-200",  text: "text-blue-900",  label: "Pending"    },
  APPROVED: { bg: "bg-lime-200",  text: "text-lime-900",  label: "Published"  },
  REJECTED: { bg: "bg-red-200",   text: "text-red-900",   label: "Rejected"   },
  ARCHIVED: { bg: "bg-gray-200",  text: "text-gray-500",  label: "Archived"   },
};

function StatCard({
  label, value, sub, good, delay = 0,
}: { label: string; value: string | number; sub: string; good?: boolean; delay?: number }) {
  return (
    <Card className="hover:shadow-sm transition-shadow stagger-item" style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-4 sm:p-6">
        <div className="font-headline text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">{label}</div>
        <div className="font-headline text-3xl sm:text-5xl font-black italic tracking-tighter text-gray-900 mb-1.5">{value}</div>
        <div className="text-[11px] sm:text-[12px] text-gray-500">{sub}</div>
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

  const recent = [...events]
    .filter(e => e.status !== "ARCHIVED")
    .sort((a, b) => {
      const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (diff !== 0) return diff;
      return a.eventDate.localeCompare(b.eventDate);
    })
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 lg:pb-12 page-in">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-10">
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-2">
                Welcome back
              </div>
              <h1 className="font-headline text-[36px] sm:text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none text-gray-900">
                Hi there.<br /><span className="text-lime-500">Here's your day.</span>
              </h1>
              <p className="text-gray-500 mt-3 text-[14px] sm:text-[15px]">
                {loading
                  ? "Loading your events…"
                  : stats.live > 0
                  ? `${stats.live} event${stats.live !== 1 ? "s" : ""} live and taking registrations.`
                  : events.length === 0
                  ? "No events yet. Create your first listing to get started."
                  : "No live events right now. Submit a draft to go live."}
              </p>
            </div>
            <Button asChild size="lg" className="self-start sm:self-end shrink-0">
              <Link href="/organiser/listings">
                <CalendarDays className="w-4 h-4" /> View my events
              </Link>
            </Button>
          </div>

          {/* Stats — always 3 columns, compact on mobile */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-10">
            <StatCard label="Live now"      value={loading ? "—" : stats.live}          sub={`of ${stats.total} total`} good delay={0}   />
            <StatCard label="Registrations" value={loading ? "—" : stats.registrations} sub="all events"                good={stats.registrations > 0} delay={60}  />
            <StatCard label="Total events"  value={loading ? "—" : stats.total}         sub="all time"                  delay={120} />
          </div>

          {/* Recent events */}
          <section className="stagger-item" style={{ animationDelay: "160ms" }}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="font-headline text-lg sm:text-xl font-black italic tracking-tighter text-gray-900">Your upcoming events</h2>
              <Link href="/organiser/listings" className="font-headline text-[11px] uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <Card>
              {/* Desktop table header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 font-headline font-bold text-[11px] uppercase tracking-widest text-gray-700 rounded-t-lg">
                <div className="col-span-5">Event</div>
                <div className="col-span-2 text-center">Date</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2">Registered / Cap</div>
                <div className="col-span-1" />
              </div>

              {loading && (
                <div className="p-10 text-center">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                  <div className="font-headline text-sm text-gray-500 uppercase tracking-widest">Loading…</div>
                </div>
              )}

              {!loading && recent.length === 0 && (
                <div className="p-10 text-center">
                  <div className="font-headline text-lg font-black italic text-gray-900 mb-1">Nothing here yet</div>
                  <div className="text-gray-500 text-sm mb-5">Create your first listing to get started.</div>
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
                const href  = e.status === "APPROVED" ? `/organiser/events/${e.id}/dashboard` : `/organiser/events/${e.id}`;
                return (
                  <div key={e.id} className={i < recent.length - 1 ? "border-b border-gray-100" : ""}>

                    {/* Mobile card (< sm) */}
                    <div
                      className="sm:hidden flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-gray-50 transition-colors"
                      onClick={() => router.push(href)}
                    >
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {e.coverImageUrl
                          ? <img src={e.coverImageUrl} alt={e.title} className="w-full h-full object-cover" />
                          : <div className="font-mono text-[9px] text-gray-400 uppercase">{e.discipline.slice(0, 4)}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-0.5">
                          <div className="font-headline text-[14px] font-black italic tracking-tighter text-gray-900 leading-tight line-clamp-1 flex-1">{e.title}</div>
                          <Badge className={`${s.bg} ${s.text} border-0 text-[10px] shrink-0`}>{s.label}</Badge>
                        </div>
                        <div className="flex items-center gap-1 font-headline text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                          <MapPin className="w-3 h-3 text-lime-500 shrink-0" /> {e.city}, {e.state.toUpperCase()}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="font-headline text-[11px] text-gray-500">{formatEventDate(e.eventDate, e.startTime)}</div>
                          <div className="font-headline text-[11px] text-gray-600">
                            {(e.registrationCount ?? 0)}{e.cap ? `/${e.cap}` : ""}<span className="text-gray-400"> reg</span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </div>

                    {/* Desktop table row (≥ sm) */}
                    <div
                      className={`hidden sm:grid grid-cols-12 gap-4 px-5 py-4 items-center cursor-pointer transition-all
                        ${e.status === "APPROVED"
                          ? "hover:bg-lime-50 hover:border-l-2 hover:border-l-lime-400"
                          : "hover:bg-gray-50 hover:border-l-2 hover:border-l-gray-300"}`}
                      onClick={() => router.push(href)}
                    >
                      <div className="col-span-5 flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {e.coverImageUrl
                            ? <img src={e.coverImageUrl} alt={e.title} className="w-full h-full object-cover" />
                            : <div className="font-mono text-[9px] text-gray-400 uppercase">{e.discipline.slice(0, 4)}</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="font-headline text-[15px] font-black italic tracking-tighter text-gray-900">{e.title}</div>
                          <div className="flex items-center gap-1 font-headline text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">
                            <MapPin className="w-3 h-3 text-lime-500" /> {e.city}, {e.state.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 text-center">
                        <div className="font-headline text-sm font-bold text-gray-700">{formatEventDate(e.eventDate, e.startTime)}</div>
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge>
                      </div>
                      <div className="col-span-2">
                        <div className="font-headline text-sm font-bold text-gray-900">
                          {(e.registrationCount ?? 0).toLocaleString()}
                          {e.cap
                            ? <span className="text-gray-400 font-normal"> / {e.cap.toLocaleString()}</span>
                            : <span className="text-gray-400 font-normal"> / —</span>}
                        </div>
                        {price && <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mt-0.5">from A${price}</div>}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <ArrowRight className="w-4 h-4 text-gray-300" />
                      </div>
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
