"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { CalendarDays, User, ArrowRight, MapPin } from "lucide-react";
import OrganiserTopBar from "@/components/organiser/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; startTime: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null;
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

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string; pulse?: boolean }> = {
  DRAFT:    { bg: "bg-gray-100",  text: "text-gray-500",  dot: "bg-gray-400",  label: "Draft"    },
  PENDING:  { bg: "bg-blue-50",   text: "text-blue-600",  dot: "bg-blue-500",  label: "Pending"  },
  APPROVED: { bg: "bg-lime-50",   text: "text-lime-700",  dot: "bg-lime-500",  label: "Live",    pulse: true },
  REJECTED: { bg: "bg-red-50",    text: "text-red-600",   dot: "bg-red-500",   label: "Rejected" },
  ARCHIVED: { bg: "bg-gray-100",  text: "text-gray-400",  dot: "bg-gray-300",  label: "Archived" },
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
        <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400 mb-3">{label}</div>
        <div className="font-headline text-5xl font-black italic tracking-tighter text-gray-900 mb-3">{value}</div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-gray-500">{sub}</span>
          {trend && (
            <span className={`font-headline text-[11px] uppercase tracking-widest ${good ? "text-lime-600" : "text-gray-400"}`}>
              {trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  icon: Icon, label, hint, href,
}: { icon: React.ComponentType<{ className?: string }>; label: string; hint: string; href: string }) {
  return (
    <Link href={href} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none group will-change-transform transition-all duration-300 ease-out">
      <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-gray-900 group-hover:text-white transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-headline text-[14px] font-bold text-gray-900">{label}</div>
        <div className="text-[11px] text-gray-400">{hint}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
    </Link>
  );
}

export default function DashboardPage() {
  const [events,  setEvents]  = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organiser/events")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setEvents(d); })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({
    live:  events.filter(e => e.status === "APPROVED").length,
    total: events.length,
    draft: events.filter(e => e.status === "DRAFT").length,
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
              <p className="text-gray-500 mt-4 max-w-xl text-[15px]">
                {loading
                  ? "Loading your eventsâ€¦"
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
            <StatCard label="Events live now"  value={loading ? "—" : stats.live}  sub={`of ${stats.total} total`} good trend={stats.live > 0 ? "Taking sign-ups" : undefined} delay={0}   />
            <StatCard label="Drafts"           value={loading ? "—" : stats.draft} sub="not yet published"                                                                         delay={80}  />
            <StatCard label="Total events"     value={loading ? "—" : stats.total} sub="all time"                                                                                  delay={160} />
          </div>

          {/* Body grid */}
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">

            {/* Recent events */}
            <section className="stagger-item" style={{ animationDelay: "200ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900">Your upcoming events</h2>
                <Link href="/organiser/listings" className="font-headline text-[11px] uppercase tracking-widest text-gray-400 hover:text-gray-900 flex items-center gap-1 transition-colors">
                  See all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {loading && (
                  <div className="p-10 text-center">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                    <div className="font-headline text-sm text-gray-400 uppercase tracking-widest">Loadingâ€¦</div>
                  </div>
                )}

                {!loading && recent.length === 0 && (
                  <div className="p-10 text-center">
                    <div className="font-headline text-lg font-black italic text-gray-900 mb-1">Nothing here yet</div>
                    <div className="text-gray-400 text-sm mb-5">Create your first listing to get started.</div>
                    <Button asChild>
                      <Link href="/organiser/new-listing">
                        <CalendarDays className="w-4 h-4" /> Add new listing
                      </Link>
                    </Button>
                  </div>
                )}

                {!loading && recent.map((e, i) => {
                  const s = STATUS_STYLE[e.status];
                  return (
                    <Link key={e.id} href="/organiser/listings"
                      className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-lime-50 hover:border-l-2 hover:border-l-lime-400 transition-all ${i < recent.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <div className="col-span-6 flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {e.coverImageUrl
                            ? <img src={e.coverImageUrl} alt={e.title} className="w-full h-full object-cover" />
                            : <div className="font-mono text-[9px] text-gray-400 uppercase">{e.discipline.slice(0, 4)}</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="font-headline text-[15px] font-black italic tracking-tighter text-gray-900 truncate">{e.title}</div>
                          <div className="flex items-center gap-1 font-headline text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">
                            <MapPin className="w-3 h-3 text-lime-500" /> {e.city}, {e.state.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <div className="font-headline text-sm font-bold text-gray-700">{formatEventDate(e.eventDate, e.startTime)}</div>
                      </div>
                      <div className="col-span-2">
                        <Badge className={`gap-1.5 ${s.bg} ${s.text} border-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse-dot" : ""}`} />
                          {s.label}
                        </Badge>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <ArrowRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Sidebar panels */}
            <aside className="space-y-4">
              <Card className="stagger-item" style={{ animationDelay: "260ms" }}>
                <CardContent className="p-5">
                  <h3 className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Quick actions</h3>
                  <div className="space-y-2">
                    <QuickAction icon={CalendarDays} label="View all events" hint="Manage your listings" href="/organiser/listings" />
                    <QuickAction icon={User}         label="Edit my profile" hint="Bio, logo, socials"   href="/organiser/profile"  />
                  </div>
                </CardContent>
              </Card>
            </aside>

          </div>
        </div>
      </main>
    </div>
  );
}

