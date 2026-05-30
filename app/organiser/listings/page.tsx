"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, MapPin, RefreshCw, Search, MoreHorizontal, Pencil, LayoutDashboard } from "lucide-react";
import OrganiserTopBar from "@/components/organiser/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; startTime: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null; registrationCount: number;
}

function formatEventDate(dateStr: string, startTime: string) {
  try {
    const d    = new Date(dateStr + "T00:00:00");
    const day  = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
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

type Filter = EventStatus | "all";

const FILTERS: { k: Filter; l: string }[] = [
  { k: "all",      l: "All"      },
  { k: "APPROVED", l: "Live"     },
  { k: "PENDING",  l: "Pending"  },
  { k: "DRAFT",    l: "Drafts"   },
  { k: "REJECTED", l: "Rejected" },
  { k: "ARCHIVED", l: "Archived" },
];

// ── Actions dropdown ────────────────────────────────────────────────────────
function ActionsMenu({ event, onDelete }: { event: EventRow; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const router          = useRouter();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isLive = event.status === "APPROVED";

  return (
    <div ref={ref} className="relative">
      <Button
        size="icon" variant="ghost"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">

          {/* Dashboard — only for LIVE events */}
          {isLive && (
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); router.push(`/organiser/events/${event.id}/dashboard`); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-lime-50 hover:text-lime-700 transition-colors font-headline font-bold uppercase tracking-widest"
            >
              <LayoutDashboard className="w-4 h-4" /> View dashboard
            </button>
          )}

          {/* Edit */}
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); router.push(`/organiser/new-listing?id=${event.id}`); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors font-headline font-bold uppercase tracking-widest"
          >
            <Pencil className="w-4 h-4" /> Edit event
          </button>

          <div className="my-1 border-t border-gray-100" />

          {/* Delete */}
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors font-headline font-bold uppercase tracking-widest"
          >
            <Trash2 className="w-4 h-4" /> Delete event
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ListingsPage() {
  const router = useRouter();
  const [events,     setEvents]     = useState<EventRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<Filter>("all");
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
    events.filter(e => filter === "all" || e.status === filter),
    [events, filter],
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: events.length };
    FILTERS.slice(1).forEach(({ k }) => { out[k] = events.filter(e => e.status === k).length; });
    return out;
  }, [events]);

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/organiser/events/${confirmDel.id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents(es => es.filter(e => e.id !== confirmDel.id));
        setConfirmDel(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleRowClick = (e: EventRow) => {
    if (e.status === "APPROVED") {
      router.push(`/organiser/events/${e.id}/dashboard`);
    } else {
      router.push(`/organiser/events/${e.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-16">
        <div className="max-w-[1200px] mx-auto px-6 py-10 pb-24 lg:pb-12 page-in">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-3">
                Event Listings
              </div>
              <h1 className="font-headline text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none text-gray-900">
                Your race<br /><span className="text-lime-500">calendar.</span>
              </h1>
              <p className="text-gray-500 mt-4 max-w-xl">
                {events.length > 0
                  ? `${events.length} listing${events.length !== 1 ? "s" : ""} on the board.`
                  : "No listings yet. Create your first event to get started."}
              </p>
            </div>
            <Button asChild size="lg" className="self-start lg:self-end">
              <Link href="/organiser/new-listing">
                <Plus className="w-4 h-4" /> Add New Event
              </Link>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {FILTERS.map(({ k, l }) => (
              <Button key={k} size="sm" variant={filter === k ? "lime" : "outline"} onClick={() => setFilter(k)}>
                {l} <span className="opacity-60 ml-1">({counts[k] ?? 0})</span>
              </Button>
            ))}
            <Button size="icon" variant="outline" onClick={fetchEvents} title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Table */}
          <Card className="overflow-hidden stagger-item">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 font-headline font-bold text-[12px] uppercase tracking-widest text-gray-900">
              <div className="col-span-5">Event</div>
              <div className="col-span-2 text-center">Date</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2">Registered / Cap</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {loading && (
              <div className="p-12 text-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-gray-400 uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && filtered.map((e, i) => {
              const s     = STATUS_STYLE[e.status];
              const price = (e.waves as { price: string }[])?.[0]?.price;
              const isLive = e.status === "APPROVED";
              return (
                <div key={e.id}
                  onClick={() => handleRowClick(e)}
                  className={`grid grid-cols-12 gap-4 px-5 py-4 items-center cursor-pointer transition-all
                    ${isLive
                      ? "hover:bg-lime-50 hover:border-l-2 hover:border-l-lime-400"
                      : "hover:bg-gray-50 hover:border-l-2 hover:border-l-gray-300"}
                    ${i < filtered.length - 1 ? "border-b border-gray-100" : ""}`}>

                  {/* Event info */}
                  <div className="col-span-5 flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
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

                  {/* Date */}
                  <div className="col-span-2 text-center">
                    <div className="font-headline text-sm font-bold text-gray-700">{formatEventDate(e.eventDate, e.startTime)}</div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex justify-center">
                    <Badge className={`${s.bg} ${s.text} border-0`}>
                      {s.label}
                    </Badge>
                  </div>

                  {/* Registrations */}
                  <div className="col-span-2">
                    <div className="font-headline text-sm font-bold text-gray-900">
                      {(e.registrationCount ?? 0).toLocaleString()}
                      {e.cap
                        ? <span className="text-gray-400 font-normal"> / {e.cap.toLocaleString()}</span>
                        : <span className="text-gray-400 font-normal"> / —</span>}
                    </div>
                    {price && <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mt-0.5">from A${price}</div>}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end">
                    <ActionsMenu event={e} onDelete={() => setConfirmDel(e)} />
                  </div>
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4">
                  <Search className="w-5 h-5 text-gray-400" />
                </div>
                <div className="font-headline text-lg font-black italic text-gray-900 mb-1">Nothing here yet</div>
                <div className="text-gray-400 text-sm">
                  {events.length === 0 ? "Create your first listing to get started." : "Try clearing filters or adjusting your search."}
                </div>
              </div>
            )}
          </Card>

          {events.length > 0 && !loading && (
            <Link href="/organiser/new-listing"
              className="group w-full mt-4 border border-dashed border-gray-200 hover:border-lime-400 bg-white rounded-xl p-5 flex items-center justify-center gap-3 text-gray-400 hover:text-lime-600 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:shadow-none transition-[transform,box-shadow] duration-200 ease-out">
              <Plus className="w-5 h-5" />
              <span className="font-headline text-sm font-bold uppercase tracking-widest">Add another event</span>
            </Link>
          )}
        </div>
      </main>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDel} onOpenChange={open => { if (!open) setConfirmDel(null); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <DialogTitle>Delete this event?</DialogTitle>
            </div>
            <DialogDescription>
              You&apos;re about to delete <span className="text-gray-900 font-semibold">{confirmDel?.title}</span>.
              This will remove it from the platform and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
