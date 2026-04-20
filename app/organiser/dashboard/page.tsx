"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Eye, Edit, MoreHorizontal, MapPin, RefreshCw } from "lucide-react";
import OrganiserSidebar from "@/components/organiser/Sidebar";
import OrganiserTopBar  from "@/components/organiser/TopBar";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; status: EventStatus; waves: { price: string }[];
}

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string; pulse?: boolean }> = {
  DRAFT:    { bg: "bg-dark-lighter",  text: "text-muted",        dot: "bg-muted",        label: "Draft"    },
  PENDING:  { bg: "bg-blue-900/30",   text: "text-blue-400",     dot: "bg-blue-400",     label: "Pending"  },
  APPROVED: { bg: "bg-primary/10",    text: "text-primary",      dot: "bg-primary",      label: "Approved", pulse: true },
  REJECTED: { bg: "bg-red-900/30",    text: "text-red-400",      dot: "bg-red-400",      label: "Rejected" },
  ARCHIVED: { bg: "bg-dark-light",    text: "text-muted-dark",   dot: "bg-muted-dark",   label: "Archived" },
};

const FILTERS: { k: EventStatus | "all"; l: string }[] = [
  { k: "all",      l: "All"      },
  { k: "APPROVED", l: "Live"     },
  { k: "PENDING",  l: "Pending"  },
  { k: "DRAFT",    l: "Drafts"   },
  { k: "REJECTED", l: "Rejected" },
  { k: "ARCHIVED", l: "Archived" },
];

export default function DashboardPage() {
  const [events,  setEvents]  = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<EventStatus | "all">("all");
  const [query,   setQuery]   = useState("");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/organiser/events");
      const data = await res.json();
      if (res.ok) setEvents(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const filtered = useMemo(() =>
    events.filter((e) =>
      (filter === "all" || e.status === filter) &&
      (query === "" || e.title.toLowerCase().includes(query.toLowerCase()) || e.city.toLowerCase().includes(query.toLowerCase()))
    ), [events, filter, query]
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: events.length };
    FILTERS.slice(1).forEach(({ k }) => { out[k] = events.filter((e) => e.status === k).length; });
    return out;
  }, [events]);

  return (
    <div className="min-h-screen bg-dark-darker">
      <OrganiserTopBar />
      <div className="flex pt-16">
        <OrganiserSidebar />

        <main className="flex-1 min-w-0 p-6 lg:p-10 anim-fade-slide">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-3 flex items-center gap-3">
                <span className="w-8 h-px bg-primary" /> Event Listings
              </div>
              <h1 className="font-headline text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none">
                Your race<br /><span className="text-primary">calendar.</span>
              </h1>
              <p className="text-muted mt-4 max-w-xl">
                {events.length > 0 ? `${events.length} listing${events.length !== 1 ? "s" : ""} on the board.` : "No listings yet. Create your first event to get started."}
              </p>
            </div>
            <Link href="/organiser/new-listing"
              className="bg-machined shadow-machined self-start lg:self-end text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-4 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform">
              <Plus className="w-4 h-4" /> Add New Listing
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total listings", value: events.length,                                          sub: "all time"      },
              { label: "Live",           value: counts["APPROVED"] ?? 0,                                sub: "approved"      },
              { label: "Pending review", value: counts["PENDING"]  ?? 0,                                sub: "awaiting admin" },
              { label: "Drafts",         value: counts["DRAFT"]    ?? 0,                                sub: "not submitted" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-dark border border-dark-lighter rounded-lg p-5">
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-3">{label}</div>
                <div className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">{value}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted">{sub}</div>
              </div>
            ))}
          </div>

          {/* Filters + search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(({ k, l }) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md chip ${filter === k ? "chip-active" : ""}`}>
                  {l} <span className="opacity-60 ml-1">({counts[k] ?? 0})</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchEvents} title="Refresh" className="w-9 h-9 rounded border border-dark-lighter text-muted hover:text-primary hover:border-primary/60 flex items-center justify-center transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or city…"
                  className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-3 py-2.5 text-[13px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-dark border border-dark-lighter rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-dark-light border-b border-dark-lighter font-headline text-[10px] uppercase tracking-widest text-muted">
              <div className="col-span-5">Event</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Entry from</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {loading && (
              <div className="p-12 text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-muted uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && filtered.map((e, i) => {
              const s     = STATUS_STYLE[e.status];
              const price = (e.waves as { price: string }[])?.[0]?.price;
              return (
                <div key={e.id} className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-dark-light/40 transition-colors ${i < filtered.length - 1 ? "border-b border-dark-lighter" : ""}`}>
                  <div className="col-span-5 flex items-center gap-4 min-w-0">
                    <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 placeholder-stripes bg-dark-light flex items-center justify-center">
                      <div className="font-mono text-[9px] text-muted uppercase">{e.discipline.slice(0, 4)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">{e.title}</div>
                      <div className="flex items-center gap-1 font-headline text-[11px] text-muted uppercase tracking-widest mt-0.5">
                        <MapPin className="w-3 h-3 text-primary" /> {e.city}, {e.state.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="font-headline text-sm font-bold text-light">{e.eventDate}</div>
                  </div>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-headline text-[10px] font-bold uppercase tracking-widest ${s.bg} ${s.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse-dot" : ""}`} /> {s.label}
                    </span>
                    {e.status === "REJECTED" && <div className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1">Edit &amp; resubmit</div>}
                  </div>
                  <div className="col-span-2">
                    <div className="font-headline text-sm font-bold text-light">{price ? `A$${price}` : "—"}</div>
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <button title="View"  className="w-8 h-8 rounded hover:bg-dark-lighter text-muted hover:text-primary flex items-center justify-center transition-colors"><Eye  className="w-4 h-4" /></button>
                    <button title="Edit"  className="w-8 h-8 rounded hover:bg-dark-lighter text-muted hover:text-primary flex items-center justify-center transition-colors"><Edit className="w-4 h-4" /></button>
                    <button title="More"  className="w-8 h-8 rounded hover:bg-dark-lighter text-muted hover:text-primary flex items-center justify-center transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-dark-light border border-dark-lighter mb-4">
                  <Search className="w-5 h-5 text-muted" />
                </div>
                <div className="font-headline text-lg font-black italic text-light mb-1">Nothing here yet</div>
                <div className="text-muted text-sm">
                  {events.length === 0 ? "Create your first listing to get started." : "Try clearing filters or adjusting your search."}
                </div>
              </div>
            )}
          </div>

          {events.length > 0 && (
            <Link href="/organiser/new-listing"
              className="group w-full mt-4 border border-dashed border-dark-lighter hover:border-primary/60 rounded-lg p-5 flex items-center justify-center gap-3 text-muted hover:text-primary transition-colors">
              <Plus className="w-5 h-5" />
              <span className="font-headline text-sm font-bold uppercase tracking-widest">Add another listing</span>
            </Link>
          )}
        </main>
      </div>
    </div>
  );
}
