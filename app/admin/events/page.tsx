"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CheckCircle, XCircle, Clock, MapPin, Calendar, ChevronDown, ChevronUp } from "lucide-react";

type EvtStatus = "PENDING" | "APPROVED" | "REJECTED" | "DRAFT" | "all";

interface AdminEvent {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; startTime: string; status: string;
  tagline: string | null; description: string | null; venue: string;
  format: string; level: string; categories: string[];
  registrationUrl: string | null; waves: { label: string; price: string }[];
  createdAt: string;
  organiser: { orgName: string | null; email: string; contactName: string | null };
}

function AdminEventsInner() {
  const searchParams = useSearchParams();
  const [events,  setEvents]  = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes,   setNotes]   = useState<Record<string, string>>({});
  const [reason,  setReason]  = useState<Record<string, string>>({});
  const [acting,  setActing]  = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EvtStatus>(
    (searchParams.get("s") as EvtStatus) ?? "PENDING"
  );

  const FILTERS: { k: EvtStatus; l: string }[] = [
    { k: "PENDING",  l: "Pending"  },
    { k: "APPROVED", l: "Approved" },
    { k: "REJECTED", l: "Rejected" },
    { k: "DRAFT",    l: "Drafts"   },
    { k: "all",      l: "All"      },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/admin/events?status=${statusFilter}`);
    const data = await res.json();
    setEvents(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    await fetch(`/api/admin/events/${id}/${action}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ notes: notes[id], reason: reason[id] }),
    });
    setActing(null);
    load();
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      <div className="p-6 lg:p-10 max-w-[1000px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/dashboard" className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <span className="text-muted-dark">/</span>
          <span className="font-headline text-[11px] uppercase tracking-widest text-light">Events</span>
        </div>

        <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-6">
          Event<br /><span className="text-primary">listings.</span>
        </h1>

        <div className="flex gap-2 mb-6">
          {FILTERS.map(({ k, l }) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md chip ${statusFilter === k ? "chip-active" : ""}`}>
              {l}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>}

        {!loading && events.length === 0 && (
          <div className="text-center py-16">
            <Clock className="w-8 h-8 text-muted mx-auto mb-3" />
            <div className="font-headline text-lg font-black italic text-light mb-1">All clear</div>
            <div className="text-muted text-sm">No {statusFilter === "all" ? "" : statusFilter.toLowerCase()} events to review.</div>
          </div>
        )}

        <div className="space-y-3">
          {events.map((evt) => (
            <div key={evt.id} className="bg-dark border border-dark-lighter rounded-lg overflow-hidden">
              <button onClick={() => setExpanded(expanded === evt.id ? null : evt.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-dark-light/30 transition-colors text-left">
                <div className="relative w-14 h-14 rounded-md overflow-hidden flex-shrink-0 placeholder-stripes bg-dark-light flex items-center justify-center">
                  <div className="font-mono text-[9px] text-muted uppercase">{evt.discipline.slice(0, 4)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">{evt.title}</div>
                  <div className="flex items-center gap-3 font-headline text-[11px] uppercase tracking-widest text-muted mt-0.5">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary" />{evt.city}, {evt.state.toUpperCase()}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-primary" />{evt.eventDate}</span>
                  </div>
                  <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5">
                    By {evt.organiser.orgName ?? evt.organiser.email}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <EvtStatusBadge status={evt.status} />
                  {expanded === evt.id ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                </div>
              </button>

              {expanded === evt.id && (
                <div className="border-t border-dark-lighter p-5 space-y-4">
                  {evt.tagline && (
                    <p className="text-muted-light text-[14px] italic border-l-2 border-primary/40 pl-3">{evt.tagline}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-[13px]">
                    {[
                      { l: "Discipline", v: evt.discipline },
                      { l: "Format",     v: evt.format },
                      { l: "Level",      v: evt.level },
                      { l: "Venue",      v: evt.venue },
                      { l: "Start time", v: evt.startTime },
                      { l: "Categories", v: (evt.categories as string[]).join(", ") || "—" },
                    ].map(({ l, v }) => (
                      <div key={l}>
                        <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-0.5">{l}</div>
                        <div className="text-light truncate">{v}</div>
                      </div>
                    ))}
                  </div>

                  {(evt.waves as { label: string; price: string }[]).length > 0 && (
                    <div>
                      <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">Ticket waves</div>
                      <div className="flex flex-wrap gap-2">
                        {(evt.waves as { label: string; price: string }[]).map((w, i) => (
                          <div key={i} className="bg-dark-light border border-dark-lighter rounded-md px-3 py-1.5">
                            <div className="font-headline text-[11px] uppercase tracking-widest text-muted">{w.label}</div>
                            <div className="font-headline text-[14px] font-bold text-primary">A${w.price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evt.registrationUrl && (
                    <div>
                      <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-1">Registration URL</div>
                      <a href={evt.registrationUrl} target="_blank" rel="noopener" className="text-primary text-[13px] hover:underline truncate block">{evt.registrationUrl}</a>
                    </div>
                  )}

                  {evt.description && (
                    <div>
                      <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-1">Description</div>
                      <p className="text-muted-light text-[13px] leading-relaxed line-clamp-4">{evt.description}</p>
                    </div>
                  )}

                  {evt.status === "PENDING" && (
                    <div className="border-t border-dark-lighter pt-4 space-y-3">
                      <div>
                        <label className="font-headline text-[10px] uppercase tracking-widest text-muted block mb-1.5">Internal notes</label>
                        <textarea rows={2} value={notes[evt.id] ?? ""} onChange={(e) => setNotes({ ...notes, [evt.id]: e.target.value })}
                          placeholder="Notes visible to admins only…"
                          className="w-full bg-dark-light border border-dark-lighter rounded-md px-3 py-2 text-[13px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none resize-none" />
                      </div>
                      <div>
                        <label className="font-headline text-[10px] uppercase tracking-widest text-muted block mb-1.5">Rejection reason (sent to organiser)</label>
                        <textarea rows={2} value={reason[evt.id] ?? ""} onChange={(e) => setReason({ ...reason, [evt.id]: e.target.value })}
                          placeholder="e.g. Registration URL is broken. Please fix and resubmit."
                          className="w-full bg-dark-light border border-dark-lighter rounded-md px-3 py-2 text-[13px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none resize-none" />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => act(evt.id, "approve")} disabled={acting === evt.id}
                          className="bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50">
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => act(evt.id, "reject")} disabled={acting === evt.id}
                          className="bg-dark border border-red-500/40 hover:border-red-500 text-red-400 hover:text-red-300 font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md flex items-center gap-2 transition-colors disabled:opacity-50">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EvtStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:  "bg-blue-900/30 text-blue-400",
    APPROVED: "bg-primary/10 text-primary",
    REJECTED: "bg-red-900/30 text-red-400",
    DRAFT:    "bg-dark-lighter text-muted",
    ARCHIVED: "bg-dark-light text-muted-dark",
  };
  return (
    <span className={`font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${map[status] ?? "bg-dark-lighter text-muted"}`}>
      {status}
    </span>
  );
}

export default function AdminEventsPage() {
  return <Suspense><AdminEventsInner /></Suspense>;
}
