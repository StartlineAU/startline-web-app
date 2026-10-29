"use client";

import { useState, useCallback } from "react";
import { Send, RefreshCw, CheckCircle, Clock } from "lucide-react";
import { useApiResource } from "@/hooks/useApiResource";

export const dynamic = "force-dynamic";

interface PayoutEvent {
  id: string;
  title: string;
  eventDate: string;
  endDate: string | null;
  organiser: { id: string; orgName: string | null };
  netCents: number;
}

const formatAud = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminPayoutsPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");

  const fetchPayouts = useCallback(async (signal: AbortSignal) => {
    const response = await fetch("/api/admin/payouts", { signal });
    const data = await response.json() as { events: PayoutEvent[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Failed to load payouts.");
    return data.events;
  }, []);

  const {
    data: eventsData,
    loading,
    error: loadError,
    reload: load,
    setData: setEvents,
  } = useApiResource<PayoutEvent[]>(fetchPayouts);
  const events = eventsData ?? [];
  const error = loadError ?? actionError;

  const runPayout = async (eventId: string) => {
    setRunning(eventId);
    setActionError("");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Payout failed.");
      }
      setDone((prev) => [...prev, eventId]);
      setEvents((prev) => (prev ?? []).filter((event) => event.id !== eventId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Payout failed.");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pt-14">
      <div className="mb-8">
        <h1 className="font-headline text-2xl sm:text-3xl font-black italic tracking-tighter text-light">
          Stripe payouts
        </h1>
        <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-1">
          Push event earnings from the organiser&apos;s Stripe Express balance to their bank account
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 font-headline text-[12px] uppercase tracking-widest text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-white/[0.06] bg-[#111]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-light">
            Ready to pay out
          </span>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-8 font-headline text-[12px] uppercase tracking-widest text-muted">
            Loading…
          </p>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
            <CheckCircle className="w-8 h-8 text-primary mb-3" />
            <p className="font-headline text-[13px] text-light">
              No events ready to pay out
            </p>
            <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-1">
              Events become eligible once their date has passed
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-headline text-[15px] font-black italic tracking-tighter text-light truncate">
                    {event.title}
                  </p>
                  <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-0.5">
                    {event.organiser.orgName ?? "Organiser"} · ended {formatDate(event.endDate ?? event.eventDate)}
                  </p>
                </div>
                <span className="font-headline text-[15px] font-black text-primary shrink-0">
                  {formatAud(event.netCents)}
                </span>
                <button
                  onClick={() => runPayout(event.id)}
                  disabled={running === event.id || done.includes(event.id)}
                  className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-[#141414] disabled:opacity-50 shrink-0"
                >
                  {done.includes(event.id) ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Sent</>
                  ) : running === event.id ? (
                    <><Clock className="w-3.5 h-3.5 animate-pulse" /> Sending…</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Pay out</>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
