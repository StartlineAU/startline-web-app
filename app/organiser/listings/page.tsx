"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, MapPin, RefreshCw, Search,
  MoreHorizontal, Pencil, LayoutDashboard,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import OrganiserTopBar from "@/components/organiser/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ef, type EventResponse } from "@/lib/event-data";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

const STATUS_ORDER: Record<EventStatus, number> = {
  APPROVED: 0,
  PENDING:  1,
  REJECTED: 2,
  DRAFT:    3,
  ARCHIVED: 4,
};

type EventRow = EventResponse;

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
  DRAFT:    { bg: "bg-gray-200",  text: "text-gray-700",  label: "Draft"      },
  PENDING:  { bg: "bg-blue-200",  text: "text-blue-900",  label: "Pending"    },
  APPROVED: { bg: "bg-lime-200",  text: "text-lime-900",  label: "Published"  },
  REJECTED: { bg: "bg-red-200",   text: "text-red-900",   label: "Rejected"   },
  ARCHIVED: { bg: "bg-gray-200",  text: "text-gray-500",  label: "Archived"   },
};

type SortField = "status" | "date" | "name";
type SortDir   = "asc" | "desc";
type Filter    = EventStatus | "all";

const FILTERS: { k: Filter; l: string }[] = [
  { k: "all",      l: "All"      },
  { k: "APPROVED", l: "Published"     },
  { k: "PENDING",  l: "Pending"  },
  { k: "DRAFT",    l: "Drafts"   },
  { k: "REJECTED", l: "Rejected" },
  { k: "ARCHIVED", l: "Archived" },
];

const SORT_LABELS: Record<SortField, string> = { status: "Status", date: "Date", name: "Name" };

// ── Actions dropdown ────────────────────────────────────────────────────────
function ActionsMenu({ event, onDelete }: { event: EventRow; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const router          = useRouter();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        size="icon" variant="ghost"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 w-10 h-10"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); router.push(`/organiser/events/${event.id}/dashboard`); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-gray-700 hover:bg-lime-50 hover:text-lime-700 transition-colors font-headline font-bold uppercase tracking-widest"
          >
            <LayoutDashboard className="w-4 h-4" /> View dashboard
          </button>
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); router.push(`/organiser/new-listing?id=${event.id}`); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors font-headline font-bold uppercase tracking-widest"
          >
            <Pencil className="w-4 h-4" /> Edit event
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-red-600 hover:bg-red-50 transition-colors font-headline font-bold uppercase tracking-widest"
          >
            <Trash2 className="w-4 h-4" /> Delete event
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sort header button (desktop table) ─────────────────────────────────────
function SortButton({
  field, active, dir, onSort, label,
}: { field: SortField; active: boolean; dir: SortDir; onSort: (f: SortField) => void; label: string }) {
  return (
    <button
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 hover:text-lime-600 transition-colors"
    >
      {label}
      {active
        ? dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
    </button>
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
  const [sortField,  setSortField]  = useState<SortField>("status");
  const [sortDir,    setSortDir]    = useState<SortDir>("asc");

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

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const list = events.filter(e => filter === "all" || e.status === filter);
    return [...list].sort((a, b) => {
      if (sortField === "date") {
        const diff = ef.eventDate(a).localeCompare(ef.eventDate(b));
        return sortDir === "asc" ? diff : -diff;
      }
      if (sortField === "name") {
        const diff = ef.title(a).localeCompare(ef.title(b));
        return sortDir === "asc" ? diff : -diff;
      }
      const diff = sortDir === "asc"
        ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        : STATUS_ORDER[b.status] - STATUS_ORDER[a.status];
      if (diff !== 0) return diff;
      return ef.eventDate(a).localeCompare(ef.eventDate(b));
    });
  }, [events, filter, sortField, sortDir]);

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

      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 lg:pb-12 page-in">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-2">
                Event Listings
              </div>
              <h1 className="font-headline text-[36px] sm:text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none text-gray-900">
                Your race<br /><span className="text-lime-500">calendar.</span>
              </h1>
              <p className="text-gray-500 mt-3 text-[14px]">
                {events.length > 0
                  ? `${events.length} listing${events.length !== 1 ? "s" : ""} on the board.`
                  : "No listings yet. Create your first event to get started."}
              </p>
            </div>
            <Button asChild size="lg" className="self-start sm:self-end shrink-0">
              <Link href="/organiser/new-listing">
                <Plus className="w-4 h-4" /> Add New Event
              </Link>
            </Button>
          </div>

          {/* Filter strip — horizontally scrollable on mobile */}
          <div className="flex items-center gap-2 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map(({ k, l }) => (
              <Button key={k} size="sm" variant={filter === k ? "lime" : "outline"}
                onClick={() => setFilter(k)}
                className="shrink-0"
              >
                {l} <span className="opacity-60 ml-1">({counts[k] ?? 0})</span>
              </Button>
            ))}
            <Button size="icon" variant="outline" onClick={fetchEvents} title="Refresh" className="shrink-0">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Mobile sort chips */}
          <div className="flex sm:hidden items-center gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
            <span className="font-headline text-[10px] uppercase tracking-widest text-gray-400 shrink-0">Sort</span>
            {(["status", "date", "name"] as SortField[]).map(field => {
              const active = sortField === field;
              return (
                <button key={field} onClick={() => handleSort(field)}
                  className={`flex items-center gap-1 px-3 h-8 rounded-full font-headline text-[11px] font-bold uppercase tracking-widest border transition-colors shrink-0
                    ${active ? "border-lime-500 bg-lime-50 text-lime-700" : "border-gray-200 text-gray-500 bg-white"}`}
                >
                  {SORT_LABELS[field]}
                  {active && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </button>
              );
            })}
          </div>

          {/* Table — desktop only header, cards on all sizes */}
          <Card className="stagger-item">
            {/* Desktop table header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 font-headline font-bold text-[11px] uppercase tracking-widest text-gray-700 rounded-t-lg">
              <div className="col-span-5">
                <SortButton field="name" active={sortField === "name"} dir={sortDir} onSort={handleSort} label="Event" />
              </div>
              <div className="col-span-2 text-center">
                <SortButton field="date" active={sortField === "date"} dir={sortDir} onSort={handleSort} label="Date" />
              </div>
              <div className="col-span-2 text-center">
                <SortButton field="status" active={sortField === "status"} dir={sortDir} onSort={handleSort} label="Status" />
              </div>
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
              const price = ef.waves(e)[0]?.price;
              return (
                <div key={e.id} className={`${i < filtered.length - 1 ? "border-b border-gray-100" : ""}`}>

                  {/* ── Mobile card layout (< sm) ── */}
                  <div
                    className="sm:hidden flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-gray-50 transition-colors"
                    onClick={() => handleRowClick(e)}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {ef.coverImageUrl(e)
                        ? <img src={ef.coverImageUrl(e)!} alt={ef.title(e)} className="w-full h-full object-cover" />
                        : <div className="font-mono text-[9px] text-gray-400 uppercase">{ef.discipline(e).slice(0, 4)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-0.5">
                        <div className="font-headline text-[14px] font-black italic tracking-tighter text-gray-900 leading-tight line-clamp-1 flex-1">
                          {ef.title(e)}
                        </div>
                        <Badge className={`${s.bg} ${s.text} border-0 text-[10px] shrink-0`}>{s.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1 font-headline text-[10px] text-gray-400 uppercase tracking-widest mb-1">
                        <MapPin className="w-3 h-3 text-lime-500 shrink-0" /> {ef.city(e)}, {ef.state(e).toUpperCase()}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-headline text-[11px] text-gray-500">{formatEventDate(ef.eventDate(e), ef.startTime(e))}</div>
                        <div className="font-headline text-[11px] text-gray-600">
                          {(e.registrationCount ?? 0)}{ef.cap(e) ? `/${ef.cap(e)}` : ""}<span className="text-gray-400"> reg</span>
                        </div>
                      </div>
                    </div>
                    <div onClick={ev => ev.stopPropagation()}>
                      <ActionsMenu event={e} onDelete={() => setConfirmDel(e)} />
                    </div>
                  </div>

                  {/* ── Desktop table row (≥ sm) ── */}
                  <div
                    className={`hidden sm:grid grid-cols-12 gap-4 px-5 py-4 items-center cursor-pointer transition-all
                      ${e.status === "APPROVED"
                        ? "hover:bg-lime-50 hover:border-l-2 hover:border-l-lime-400"
                        : "hover:bg-gray-50 hover:border-l-2 hover:border-l-gray-300"}`}
                    onClick={() => handleRowClick(e)}
                  >
                    <div className="col-span-5 flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {ef.coverImageUrl(e)
                          ? <img src={ef.coverImageUrl(e)!} alt={ef.title(e)} className="w-full h-full object-cover" />
                          : <div className="font-mono text-[9px] text-gray-400 uppercase">{ef.discipline(e).slice(0, 4)}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="font-headline text-[15px] font-black italic tracking-tighter text-gray-900">{ef.title(e)}</div>
                        <div className="flex items-center gap-1 font-headline text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">
                          <MapPin className="w-3 h-3 text-lime-500" /> {ef.city(e)}, {ef.state(e).toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="font-headline text-sm font-bold text-gray-700">{formatEventDate(ef.eventDate(e), ef.startTime(e))}</div>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Badge className={`${s.bg} ${s.text} border-0`}>{s.label}</Badge>
                    </div>
                    <div className="col-span-2">
                      <div className="font-headline text-sm font-bold text-gray-900">
                        {(e.registrationCount ?? 0).toLocaleString()}
                        {ef.cap(e)
                          ? <span className="text-gray-400 font-normal"> / {ef.cap(e)!.toLocaleString()}</span>
                          : <span className="text-gray-400 font-normal"> / —</span>}
                      </div>
                      {price && <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mt-0.5">from A${price}</div>}
                    </div>
                    <div className="col-span-1 flex items-center justify-end" onClick={ev => ev.stopPropagation()}>
                      <ActionsMenu event={e} onDelete={() => setConfirmDel(e)} />
                    </div>
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
                  {events.length === 0 ? "Create your first listing to get started." : "Try clearing the filter."}
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

      {/* Delete confirmation */}
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
              You&apos;re about to delete <span className="text-gray-900 font-semibold">{confirmDel ? ef.title(confirmDel) : ""}</span>.
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
