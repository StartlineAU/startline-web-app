"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import {
  Plus, Edit2, Trash2, RefreshCw, X,
  Calendar, MapPin, Clock, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import { FitnessEvent, EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatMediumDate } from "@/lib/utils";

interface OrgEvent extends FitnessEvent {
  status?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-primary/10 border-primary/40", text: "text-primary", label: "Approved" },
  pending:  { bg: "bg-yellow-500/10 border-yellow-500/40", text: "text-yellow-400", label: "Pending" },
  rejected: { bg: "bg-red-500/10 border-red-500/40", text: "text-red-400", label: "Rejected" },
};

export default function OrganiserDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organiser/events");
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadEvents();
  }, [authLoading, user, loadEvents]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/organiser/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        setToast("Event deleted.");
        setDeleteConfirm(null);
        await loadEvents();
      } else {
        setToast("Delete failed.");
      }
    } catch {
      setToast("Network error.");
    }
    setTimeout(() => setToast(null), 3000);
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
        <RefreshCw className="w-6 h-6 text-muted animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="bg-dark border-b border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-6 pt-48 pb-12">
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-3">
            <span className="w-10 h-px bg-primary inline-block" />
            Organiser Portal
          </p>
          <div className="flex items-end justify-between gap-6">
            <h1 className="font-headline text-4xl sm:text-5xl font-black italic tracking-tighter text-light leading-none">
              Your <span className="text-primary">Events</span>
            </h1>
            <Link
              href="/organiser/events/new"
              className="flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-xl machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
            >
              <Plus className="w-4 h-4" /> Submit Event
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 py-12">
        {events.length === 0 ? (
          <div className="bg-dark rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-dark-lighter flex items-center justify-center">
              <Calendar className="w-8 h-8 text-muted" />
            </div>
            <h2 className="font-headline text-xl font-black italic tracking-tighter text-light mb-2">
              No events yet
            </h2>
            <p className="text-muted text-sm mb-6">
              Submit your first event to get it listed on StartLine.
            </p>
            <Link
              href="/organiser/events/new"
              className="inline-flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-xl machined-button-shadow"
            >
              <Plus className="w-4 h-4" /> Submit Event
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const statusInfo = STATUS_STYLES[event.status ?? "approved"] ?? STATUS_STYLES.approved;
              return (
                <div
                  key={event.id}
                  className="bg-dark rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-2 py-0.5 rounded-full">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                      <span className={`font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusInfo.bg} ${statusInfo.text}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <h3 className="font-headline text-lg font-black italic tracking-tighter text-light mb-1">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-4 font-headline text-[10px] uppercase tracking-widest text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" />
                        {formatMediumDate(event.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary" />
                        {event.city}, {STATE_LABELS[event.state]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/organiser/events/${event.id}/edit`}
                      className="flex items-center gap-1.5 font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-primary border border-dark-lighter hover:border-primary px-3 py-2 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </Link>
                    {deleteConfirm === event.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="font-headline text-[10px] font-medium uppercase tracking-widest bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-500 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-muted hover:text-light p-1 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(event.id)}
                        className="flex items-center gap-1.5 font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-red-400 border border-dark-lighter hover:border-red-400/50 px-3 py-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-primary text-dark font-headline text-sm font-medium uppercase tracking-widest shadow-xl rounded-xl">
          <CheckCircle className="w-4 h-4" />
          {toast}
        </div>
      )}
    </main>
  );
}
