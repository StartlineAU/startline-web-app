"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Pencil, AlertCircle, Clock, CheckCircle, XCircle, FileText, Send } from "lucide-react";
import OrganiserTopBar from "@/components/organiser/TopBar";
import { ef, type EventResponse } from "@/lib/event-data";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

type EventDetail = EventResponse;

function formatDate(dateStr: string, timeStr?: string) {
  try {
    const d    = new Date(dateStr + "T00:00:00");
    const date = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    if (!timeStr) return date;
    const t = new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} · ${t}`;
  } catch { return dateStr; }
}

const STATUS_META: Record<EventStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
  headline: string;
  description: string;
}> = {
  DRAFT: {
    label:       "Draft",
    color:       "text-gray-600",
    bg:          "bg-gray-50",
    border:      "border-gray-200",
    icon:        FileText,
    headline:    "This event is saved as a draft.",
    description: "It's not visible to athletes yet. Review your details and submit when you're ready for Startline to review it.",
  },
  PENDING: {
    label:       "Pending review",
    color:       "text-blue-700",
    bg:          "bg-blue-50",
    border:      "border-blue-200",
    icon:        Clock,
    headline:    "Your event is under review.",
    description: "The Startline team will review your submission and approve or provide feedback. This usually takes 1–2 business days.",
  },
  APPROVED: {
    label:       "Published",
    color:       "text-lime-700",
    bg:          "bg-lime-50",
    border:      "border-lime-200",
    icon:        CheckCircle,
    headline:    "This event is live.",
    description: "Your event is published and taking registrations.",
  },
  REJECTED: {
    label:       "Rejected",
    color:       "text-red-700",
    bg:          "bg-red-50",
    border:      "border-red-200",
    icon:        XCircle,
    headline:    "Your event was not approved.",
    description: "Review the feedback below, make the necessary changes, and resubmit.",
  },
  ARCHIVED: {
    label:       "Archived",
    color:       "text-gray-500",
    bg:          "bg-gray-50",
    border:      "border-gray-200",
    icon:        FileText,
    headline:    "This event is archived.",
    description: "It's no longer visible to athletes.",
  },
};

export default function EventStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }  = use(params);
  const router  = useRouter();

  const [event,      setEvent]      = useState<EventDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState("");

  useEffect(() => {
    fetch(`/api/organiser/events/${id}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error ?? "Failed to load")))
      .then((d: EventDetail) => {
        // Redirect live events straight to their dashboard
        if (d.status === "APPROVED") {
          router.replace(`/organiser/events/${id}/dashboard`);
          return;
        }
        setEvent(d);
      })
      .catch((e: string) => setError(e))
      .finally(() => setLoading(false));
  }, [id, router]);

  const submitForReview = async () => {
    if (!event) return;
    setSubmitErr("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/organiser/events/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ submit: true }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitErr(data.error ?? "Could not submit. Please check your event details."); return; }
      setEvent(e => e ? { ...e, status: "PENDING" } : e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OrganiserTopBar />
        <main className="pt-14">
          <div className="max-w-[900px] mx-auto px-6 py-16 text-center">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OrganiserTopBar />
        <main className="pt-14">
          <div className="max-w-[900px] mx-auto px-6 py-16 text-center">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-3" />
            <div className="font-headline text-sm font-bold uppercase tracking-widest text-gray-500 mb-5">
              {error || "Event not found."}
            </div>
            <Link href="/organiser/listings" className="font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors">
              ← Back to listings
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const meta    = STATUS_META[event.status];
  const Icon    = meta.icon;
  const isPending  = event.status === "PENDING";
  const isRejected = event.status === "REJECTED";
  const isDraft    = event.status === "DRAFT";

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-14">
        <div className="max-w-[900px] mx-auto px-6 py-8 pb-24 lg:pb-12 page-in">

          {/* ── Breadcrumb ── */}
          <div className="flex items-center gap-2 font-headline text-[11px] uppercase tracking-widest text-gray-400 mb-8">
            <Link href="/organiser/listings" className="hover:text-gray-700 transition-colors flex items-center gap-1.5">
              <ArrowLeft className="w-3 h-3" /> Listings
            </Link>
          </div>

          {/* ── Event header ── */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 mb-8">
            {ef.coverImageUrl(event) && (
              <div className="w-full lg:w-44 h-28 rounded-xl overflow-hidden shrink-0">
                <img src={ef.coverImageUrl(event)!} alt={ef.title(event)} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-headline text-[11px] font-bold uppercase tracking-widest ${meta.bg} ${meta.border} border ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="font-headline text-[11px] uppercase tracking-widest text-gray-400">
                  {ef.discipline(event).replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="font-headline text-[32px] lg:text-[40px] font-black italic tracking-tighter leading-tight text-gray-900 mb-3">
                {ef.title(event)}
              </h1>
              <div className="flex flex-col gap-1 text-[13px] text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-lime-500 shrink-0" />
                  {formatDate(ef.eventDate(event), ef.startTime(event))}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-lime-500 shrink-0" />
                  {ef.venue(event)}, {ef.city(event)} {ef.state(event).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isDraft && (
                <button
                  onClick={submitForReview}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 bg-gray-900 text-white font-headline text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? "Submitting…" : "Submit for review"}
                </button>
              )}
              {isRejected && (
                <Link
                  href={`/organiser/new-listing?id=${event.id}`}
                  className="inline-flex items-center gap-2 bg-gray-900 text-white font-headline text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit &amp; resubmit
                </Link>
              )}
              {!isRejected && (
                <Link
                  href={`/organiser/new-listing?id=${event.id}`}
                  className="inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-700 font-headline text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit event
                </Link>
              )}
            </div>
          </div>

          {/* ── Status note (minimal, no box) ── */}
          <div className="flex items-start gap-3 py-4 border-b border-gray-200 mb-8">
            <div className="flex-1">
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <span className={`font-headline font-bold ${meta.color}`}>{meta.headline} </span>
                {meta.description}
              </p>
              {isRejected && ef.rejectionReason(event) && (
                <div className="mt-3 pl-3 border-l-2 border-red-300">
                  <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Feedback from Startline</div>
                  <p className="text-[13px] text-gray-600 leading-relaxed">{ef.rejectionReason(event)}</p>
                </div>
              )}
              {submitErr && (
                <p className="mt-2 text-[12px] text-red-600">{submitErr}</p>
              )}
            </div>
          </div>

          {/* ── Event summary ── */}
          <div>
            <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900 mb-5">
              Event summary
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-1">Discipline</div>
                <div className="font-headline text-[13px] font-bold text-gray-900 capitalize">
                  {ef.discipline(event).replace(/_/g, " ")}
                </div>
              </div>
              <div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-1">Capacity</div>
                <div className="font-headline text-[13px] font-bold text-gray-900">
                  {ef.cap(event) ? ef.cap(event)!.toLocaleString() : "Unlimited"}
                </div>
              </div>
              <div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-1">Ticket tiers</div>
                <div className="font-headline text-[13px] font-bold text-gray-900">
                  {ef.waves(event).length > 0 ? `${ef.waves(event).length} tier${ef.waves(event).length !== 1 ? "s" : ""}` : "None set"}
                </div>
              </div>
              <div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-1">From</div>
                <div className="font-headline text-[13px] font-bold text-gray-900">
                  {ef.waves(event).length > 0 ? `A$${ef.waves(event)[0].price}` : "—"}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
