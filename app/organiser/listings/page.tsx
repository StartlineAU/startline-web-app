"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, MapPin, RefreshCw } from "lucide-react";
import OrganiserSidebar from "@/components/organiser/Sidebar";
import OrganiserTopBar  from "@/components/organiser/TopBar";

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

type Filter = EventStatus | "all";

const FILTERS: { k: Filter; l: string }[] = [
  { k: "all",      l: "All"      },
  { k: "APPROVED", l: "Live"     },
  { k: "PENDING",  l: "Pending"  },
  { k: "DRAFT",    l: "Drafts"   },
  { k: "REJECTED", l: "Rejected" },
  { k: "ARCHIVED", l: "Archived" },
];

export default function ListingsPage() {
  const [events,     setEvents]     = useState<EventRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<Filter>("all");
  const [query,      setQuery]      = useState("");
  const [confirmDel, setConfirmDel] = useState<EventRow | null>(null);
  const [deleting,   setDeleting]   = useState(false);

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
    events.filter(e =>
      (filter === "all" || e.status === filter) &&
      (query === "" || e.title.toLowerCase().includes(query.toLowerCase()) || e.city.toLowerCase().includes(query.toLowerCase()))
    ), [events, filter, query]
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: events.length };
    FILTERS.slice(1).forEach(({ k }) => { out[k] = events.filter(e => e.status === k).length; });
    return out;
  }, [events]);

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    // Optimistic remove — API delete endpoint can be wired up later
    setEvents(es => es.filter(e => e.id !== confirmDel.id));
    setConfirmDel(null);
    setDeleting(false);
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      <OrganiserTopBar />
      <div className="flex pt-16">
        <OrganiserSidebar />

        <main className="flex-1 min-w-0 p-6 lg:p-10 page-in">
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
                {events.length > 0
                  ? `${events.length} listing${events.length !== 1 ? "s" : ""} on the board.`
                  : "No listings yet. Create your first event to get started."}
              </p>
            </div>
            <Link
              href="/organiser/new-listing"
              className="bg-machined shadow-machined self-start lg:self-end text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-4 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
            >
              <Plus className="w-4 h-4" /> Add New Listing
            </Link>
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
              <button onClick={fetchEvents} title="Refresh"
                className="w-9 h-9 rounded border border-dark-lighter text-muted hover:text-primary hover:border-primary/60 flex items-center justify-center transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by title or city…"
                  className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-3 py-2.5 text-[13px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-dark border border-dark-lighter rounded-lg overflow-hidden stagger-item">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-dark-light border-b border-dark-lighter font-headline text-[10px] uppercase tracking-widest text-muted">
              <div className="col-span-5">Event</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Cap / Entry</div>
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
                <div key={e.id}
                  className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-dark-light/40 transition-colors ${i < filtered.length - 1 ? "border-b border-dark-lighter" : ""}`}>
                  {/* Event info */}
                  <div className="col-span-5 flex items-center gap-4 min-w-0">
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

                  {/* Date */}
                  <div className="col-span-2">
                    <div className="font-headline text-sm font-bold text-light">{e.eventDate}</div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-headline text-[10px] font-bold uppercase tracking-widest ${s.bg} ${s.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse-dot" : ""}`} />
                      {s.label}
                    </span>
                    {e.status === "REJECTED" && (
                      <div className="font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1">Edit &amp; resubmit</div>
                    )}
                  </div>

                  {/* Cap / Entry */}
                  <div className="col-span-2">
                    {e.cap ? (
                      <div>
                        <div className="font-headline text-sm font-bold text-light">{e.cap.toLocaleString()} spots</div>
                        {price && <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-0.5">from A${price}</div>}
                      </div>
                    ) : (
                      <div className="font-headline text-sm font-bold text-light">{price ? `A$${price}` : "—"}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <button title="Edit"
                      className="w-8 h-8 rounded hover:bg-dark-lighter text-muted hover:text-primary flex items-center justify-center transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button title="Delete" onClick={() => setConfirmDel(e)}
                      className="w-8 h-8 rounded hover:bg-dark-lighter text-muted hover:text-red-400 flex items-center justify-center transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
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

          {events.length > 0 && !loading && (
            <Link href="/organiser/new-listing"
              className="group w-full mt-4 border border-dashed border-dark-lighter hover:border-primary/60 rounded-lg p-5 flex items-center justify-center gap-3 text-muted hover:text-primary transition-colors">
              <Plus className="w-5 h-5" />
              <span className="font-headline text-sm font-bold uppercase tracking-widest">Add another listing</span>
            </Link>
          )}
        </main>
      </div>

      {/* Delete confirmation modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-dark-darker/80 backdrop-blur-sm overlay-in" onClick={() => setConfirmDel(null)} />
          <div className="relative bg-dark border border-dark-lighter rounded-lg p-6 max-w-md w-full modal-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-md bg-red-500/15 text-red-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-headline text-xl font-black italic tracking-tighter text-light">Delete this event?</h3>
            </div>
            <p className="text-muted text-[14px] leading-relaxed mb-6">
              You&apos;re about to delete <span className="text-light font-semibold">{confirmDel.title}</span>. This will hide it from athletes and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDel(null)}
                className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light px-5 py-3 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-3 rounded-md transition-colors">
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
