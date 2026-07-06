"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { MapPin, Calendar, Check, X, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import AdminNav from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type EventStatus = "PENDING" | "APPROVED" | "REJECTED";

interface AdminEventRow {
  id: string;
  title: string;
  discipline: string;
  city: string;
  state: string;
  eventDate: string;
  startTime: string;
  status: EventStatus;
  createdAt: string;
  coverImageUrl: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  organiser: {
    id: string;
    orgName: string | null;
    contactName: string | null;
    email: string;
  };
}

const TABS: { status: EventStatus; label: string }[] = [
  { status: "PENDING",  label: "Pending"  },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
];

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING:  { bg: "bg-blue-50",  text: "text-blue-600",  dot: "bg-blue-500",  label: "Pending"  },
  APPROVED: { bg: "bg-lime-50",  text: "text-lime-700",  dot: "bg-lime-500",  label: "Approved" },
  REJECTED: { bg: "bg-red-50",   text: "text-red-600",   dot: "bg-red-500",   label: "Rejected" },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatSubmitted(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface RejectPanelProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function RejectPanel({ onConfirm, onCancel, loading }: RejectPanelProps) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-red-700 block mb-2">
        Rejection reason <span className="text-red-500">*</span>
      </label>
      <textarea
        className="w-full text-[14px] text-gray-900 bg-white border border-red-300 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-red-500 placeholder:text-gray-400"
        rows={3}
        placeholder="Explain why the event is being rejected…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex items-center gap-2 mt-2 justify-end">
        <button
          onClick={onCancel}
          disabled={loading}
          className="font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => reason.trim() && onConfirm(reason.trim())}
          disabled={loading || !reason.trim()}
          className="font-headline text-[12px] font-bold uppercase tracking-widest bg-red-600 text-white px-4 py-1.5 rounded hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {loading
            ? <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> Rejecting…</>
            : <><X className="w-3 h-3" /> Reject</>}
        </button>
      </div>
    </div>
  );
}

function EventRow({
  event,
  onReviewed,
}: {
  event: AdminEventRow;
  onReviewed: (id: string, newStatus: EventStatus) => void;
}) {
  const [approving,    setApproving]    = useState(false);
  const [approveError, setApproveError] = useState("");
  const [rejectOpen,   setRejectOpen]   = useState(false);
  const [rejecting,    setRejecting]    = useState(false);
  const [expanded,     setExpanded]     = useState(false);

  const organiserName =
    event.organiser.orgName || event.organiser.contactName || event.organiser.email;

  const handleApprove = async () => {
    setApproving(true);
    setApproveError("");
    try {
      const res  = await fetch(`/api/admin/events/${event.id}/review`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        onReviewed(event.id, "APPROVED");
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
        setApproveError(data.error ?? "Failed to approve event.");
      }
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (reason: string) => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      if (res.ok) {
        setRejectOpen(false);
        onReviewed(event.id, "REJECTED");
      }
    } finally {
      setRejecting(false);
    }
  };

  const s = STATUS_STYLE[event.status];

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Main row */}
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Cover thumbnail */}
        <div className="relative w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          {event.coverImageUrl
            ? <Image src={event.coverImageUrl} alt={event.title} fill className="pointer-events-none object-cover" sizes="56px" />
            : <div className="font-mono text-[9px] text-gray-400 uppercase">{event.discipline.slice(0, 4)}</div>}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1 mb-1">
            <span className="font-headline text-[15px] font-black italic tracking-tighter text-gray-900 truncate">
              {event.title}
            </span>
            <Badge className={`gap-1.5 ${s.bg} ${s.text} border-0 shrink-0`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-headline text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-lime-500" />
              {event.city}, {event.state.toUpperCase()}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(event.eventDate)}
            </span>
            <span className="capitalize">{event.discipline}</span>
          </div>

          <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400">
            By <span className="text-gray-600">{organiserName}</span>
            {" · "}Submitted {formatSubmitted(event.createdAt)}
          </div>

          {/* Rejection reason (shown on REJECTED tab) */}
          {event.status === "REJECTED" && event.rejectionReason && (
            <div className="mt-2 text-[13px] text-red-600 bg-red-50 rounded px-3 py-2 border border-red-100">
              <span className="font-bold">Reason: </span>{event.rejectionReason}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-auto pl-2">
          {event.status === "PENDING" && (
            <>
              <button
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest bg-lime-500 text-white px-3 py-2 rounded-md hover:bg-lime-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {approving
                  ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                  : <Check className="w-3.5 h-3.5" />}
                Approve
              </button>
              <button
                onClick={() => { setRejectOpen((o) => !o); setApproveError(""); }}
                disabled={approving || rejecting}
                className="flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest border border-red-300 text-red-600 px-3 py-2 rounded-md hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          )}

          {/* Expand toggle (for detail view) */}
          <button
            onClick={() => setExpanded((o) => !o)}
            className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Stripe gate error — shown when organiser hasn't completed onboarding (ToS §3.4) */}
      {approveError && (
        <div className="px-5 pb-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="text-[13px] text-amber-800">{approveError}</div>
          </div>
        </div>
      )}

      {/* Reject panel */}
      {rejectOpen && (
        <div className="px-5 pb-4">
          <RejectPanel
            onConfirm={handleReject}
            onCancel={() => setRejectOpen(false)}
            loading={rejecting}
          />
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 bg-gray-50 border-t border-gray-100">
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            <div>
              <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Organiser</div>
              <div className="text-[13px] text-gray-800">
                {organiserName}
                {organiserName !== event.organiser.email && (
                  <span className="text-gray-400 ml-1">({event.organiser.email})</span>
                )}
              </div>
            </div>
            <div>
              <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Event date</div>
              <div className="text-[13px] text-gray-800">{formatDate(event.eventDate)} · {event.startTime}</div>
            </div>
            <div>
              <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Discipline</div>
              <div className="text-[13px] text-gray-800 capitalize">{event.discipline}</div>
            </div>
            {event.reviewedAt && (
              <div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Reviewed</div>
                <div className="text-[13px] text-gray-800">{formatSubmitted(event.reviewedAt)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminEventsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const statusParam  = (searchParams.get("status") ?? "PENDING").toUpperCase() as EventStatus;
  const activeTab    = TABS.find((t) => t.status === statusParam)?.status ?? "PENDING";

  const [events,     setEvents]     = useState<AdminEventRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetch(`/api/admin/events?status=${activeTab}&page=1&limit=50`)
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.events)) {
          setEvents(data.events);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        } else {
          setEvents([]);
          setTotal(0);
          setTotalPages(1);
        }
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  const switchTab = (status: EventStatus) => {
    setPage(1);
    router.push(`/admin/events?status=${status}`, { scroll: false });
  };

  const handleReviewed = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-2">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-gray-900">
                Events.
              </h1>
            </div>
            <button
              onClick={() => fetchEvents(activeTab, page)}
              className="self-start sm:self-end flex items-center gap-2 font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            {TABS.map(({ status, label }) => (
              <button
                key={status}
                onClick={() => switchTab(status)}
                className={`font-headline text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 border-b-2 transition-colors -mb-px
                  ${activeTab === status
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Events list */}
          <Card className="overflow-hidden">
            {loading && (
              <div className="p-12 text-center">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                <div className="font-headline text-sm text-gray-500 uppercase tracking-widest">Loading…</div>
              </div>
            )}

            {!loading && events.length === 0 && (
              <div className="p-12 text-center">
                <div className="font-headline text-lg font-black italic text-gray-900 mb-1">
                  {activeTab === "PENDING" ? "Queue is clear" : `No ${activeTab.toLowerCase()} events`}
                </div>
                <div className="text-gray-500 text-sm">
                  {activeTab === "PENDING"
                    ? "No events are waiting for review right now."
                    : `No events with ${activeTab.toLowerCase()} status.`}
                </div>
              </div>
            )}

            {!loading && events.length > 0 && events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onReviewed={handleReviewed}
              />
            ))}
          </Card>

          {!loading && events.length > 0 && (
            <div className="mt-4 flex items-center justify-between font-headline text-[12px] uppercase tracking-widest text-gray-400">
              <span>{total} event{total !== 1 ? "s" : ""}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const p = page - 1; setPage(p); fetchEvents(activeTab, p); }}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded border border-gray-200 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-gray-500">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => { const p = page + 1; setPage(p); fetchEvents(activeTab, p); }}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded border border-gray-200 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminEventsPage() {
  return (
    <Suspense>
      <AdminEventsContent />
    </Suspense>
  );
}
