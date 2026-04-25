"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { CalendarDays, User, ArrowRight, MapPin } from "lucide-react";
import OrganiserSidebar from "@/components/organiser/Sidebar";
import OrganiserTopBar  from "@/components/organiser/TopBar";

// Page title — picked up by app/organiser/layout.tsx template → "Dashboard | Startline Organiser"
export const dynamic = "force-dynamic";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null;
}

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string; pulse?: boolean }> = {
  DRAFT:    { bg: "bg-dark-lighter",  text: "text-muted",      dot: "bg-muted",      label: "Draft"    },
  PENDING:  { bg: "bg-blue-900/30",   text: "text-blue-400",   dot: "bg-blue-400",   label: "Pending"  },
  APPROVED: { bg: "bg-primary/15",    text: "text-primary",    dot: "bg-primary",    label: "Live",    pulse: true },
  REJECTED: { bg: "bg-red-900/30",    text: "text-red-400",    dot: "bg-red-400",    label: "Rejected" },
  ARCHIVED: { bg: "bg-dark-lighter",  text: "text-muted-dark", dot: "bg-muted-dark", label: "Archived" },
};

function StatCard({
  label, value, sub, trend, good, delay = 0,
}: { label: string; value: string | number; sub: string; trend?: string; good?: boolean; delay?: number }) {
  return (
    <div
      className="bg-dark border border-dark-lighter rounded-lg p-6 card-hover hover:border-primary/40 stagger-item"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="font-headline text-[11px] uppercase tracking-widest text-muted mb-3">{label}</div>
      <div className="font-headline text-5xl font-black italic tracking-tighter text-light mb-3">{value}</div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted">{sub}</span>
        {trend && (
          <span className={`font-headline text-[11px] uppercase tracking-widest ${good ? "text-primary" : "text-muted"}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon, label, hint, href,
}: { icon: React.ComponentType<{ className?: string }>; label: string; hint: string; href: string }) {
  return (
    <Link href={href} className="w-full flex items-center gap-3 p-3 rounded-md border border-dark-lighter hover:border-primary/50 hover:bg-dark-light/40 group transition-colors">
      <div className="w-10 h-10 rounded-md bg-dark-light flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-dark transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-headline text-[14px] font-bold text-light">{label}</div>
        <div className="text-[11px] text-muted">{hint}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
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
    live:    events.filter(e => e.status === "APPROVED").length,
    total:   events.length,
    pending: events.filter(e => e.status === "PENDING").length,
    draft:   events.filter(e => e.status === "DRAFT").length,
  }), [events]);

  const recent = events.filter(e => e.status !== "ARCHIVED").slice(0, 3);

  return (
    <div className="min-h-screen bg-dark-darker">
      <OrganiserTopBar />
      <div className="flex pt-16">
        <OrganiserSidebar />

        <main className="flex-1 min-w-0 p-6 lg:p-10 pb-24 lg:pb-10 page-in">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-3 flex items-center gap-3">
                <span className="w-8 h-px bg-primary" /> Welcome back
              </div>
              <h1 className="font-headline text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none">
                Hi there.<br /><span className="text-primary">Here's your day.</span>
              </h1>
              <p className="text-muted mt-4 max-w-xl text-[15px]">
                {loading
                  ? "Loading your events…"
                  : stats.live > 0
                  ? `${stats.live} event${stats.live !== 1 ? "s" : ""} live and taking registrations.`
                  : events.length === 0
                  ? "No events yet. Create your first listing to get started."
                  : "No live events right now. Submit a draft to go live."}
              </p>
            </div>
            <Link
              href="/organiser/listings"
              className="bg-machined shadow-machined self-start lg:self-end text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-4 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
            >
              <CalendarDays className="w-4 h-4" /> View my events
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <StatCard label="Events live now"  value={loading ? "—" : stats.live}    sub={`of ${stats.total} total`}     good trend={stats.live > 0 ? "Taking sign-ups" : undefined} delay={0}   />
            <StatCard label="Pending review"   value={loading ? "—" : stats.pending} sub="awaiting admin approval"                                                                            delay={80}  />
            <StatCard label="Drafts"           value={loading ? "—" : stats.draft}   sub="not yet submitted"                                                                                  delay={160} />
          </div>

          {/* Body grid */}
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">

            {/* Recent events */}
            <section className="stagger-item" style={{ animationDelay: "200ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline text-xl font-black italic tracking-tighter text-light">Your upcoming events</h2>
                <Link href="/organiser/listings" className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary flex items-center gap-1 transition-colors">
                  See all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="bg-dark border border-dark-lighter rounded-lg overflow-hidden">
                {loading && (
                  <div className="p-10 text-center">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <div className="font-headline text-sm text-muted uppercase tracking-widest">Loading…</div>
                  </div>
                )}

                {!loading && recent.length === 0 && (
                  <div className="p-10 text-center">
                    <div className="font-headline text-lg font-black italic text-light mb-1">Nothing here yet</div>
                    <div className="text-muted text-sm">Create your first listing to get started.</div>
                  </div>
                )}

                {!loading && recent.map((e, i) => {
                  const s     = STATUS_STYLE[e.status];
                  const price = e.waves?.[0]?.price;
                  return (
                    <Link key={e.id} href="/organiser/listings"
                      className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-dark-light/40 transition-colors ${i < recent.length - 1 ? "border-b border-dark-lighter" : ""}`}>
                      <div className="col-span-6 flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-md placeholder-stripes bg-dark-light flex items-center justify-center shrink-0">
                          <div className="font-mono text-[9px] text-muted uppercase">{e.discipline.slice(0, 4)}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">{e.title}</div>
                          <div className="flex items-center gap-1 font-headline text-[11px] text-muted uppercase tracking-widest mt-0.5">
                            <MapPin className="w-3 h-3 text-primary" /> {e.city}, {e.state.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <div className="font-headline text-sm font-bold text-light">{e.eventDate}</div>
                      </div>
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-headline text-[10px] font-bold uppercase tracking-widest ${s.bg} ${s.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse-dot" : ""}`} />
                          {s.label}
                        </span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <ArrowRight className="w-4 h-4 text-muted" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Sidebar panels */}
            <aside className="space-y-4">
              <section className="bg-dark border border-dark-lighter rounded-lg p-5 stagger-item" style={{ animationDelay: "260ms" }}>
                <h3 className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Quick actions</h3>
                <div className="space-y-2">
                  <QuickAction icon={CalendarDays} label="View all events" hint="Manage your listings"     href="/organiser/listings" />
                  <QuickAction icon={User}         label="Edit my profile" hint="Bio, logo, socials"       href="/organiser/profile"  />
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
