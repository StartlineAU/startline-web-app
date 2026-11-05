"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  QrCode, UserCheck, CheckCircle2, AlertCircle, LogIn,
  MapPin, Calendar, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SignInModal from "@/components/SignInModal";
import { useAuthContext } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { formatInEventTimeZone } from "@/lib/event-time";
import type { CheckInState } from "@/lib/check-in-window";

interface CheckinEvent {
  title: string;
  eventDate: string;
  endDate?: string | null;
  startTime: string;
  endTime?: string | null;
  venue: string;
  city: string;
  state: string;
  timeZone: string;
}

interface CheckinRegistration {
  id: string;
  athleteName: string;
  waveLabel: string | null;
  bibNumber: string | null;
  checkedInAt: string | null;
}

interface CheckInInfo {
  state: CheckInState;
  opensAt: string | null;
  closesAt: string | null;
}

interface CheckinData {
  event: CheckinEvent;
  registration: CheckinRegistration | null;
  checkIn: CheckInInfo;
}

type LoadState = "loading" | "unauth" | "notfound" | "unregistered" | "ready";

function formatDate(dateStr: string, timeStr?: string) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const date = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    if (!timeStr) return date;
    const t = new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} · ${t}`;
  } catch { return dateStr; }
}

function formatTimestamp(iso: string, timeZone: string) {
  try {
    return formatInEventTimeZone(new Date(iso), timeZone, {
      weekday: "short", day: "numeric", month: "long",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

function formatCheckInWindow(iso: string, timeZone: string) {
  return formatInEventTimeZone(new Date(iso), timeZone, {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
  });
}

export default function CheckInScreen({
  eventId,
  shortCode,
  registrationId,
}: {
  eventId: string;
  shortCode?: string;
  registrationId?: string | null;
}) {
  const { status } = useAuthContext();
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState("");

  const fetchCheckin = useCallback(async (signal: AbortSignal) => {
    const query = registrationId ? `?registrationId=${encodeURIComponent(registrationId)}` : "";
    const url = shortCode
      ? `/api/checkin/${eventId}/${shortCode}`
      : `/api/checkin/${eventId}${query}`;
    const response = await fetch(url, { signal });
    if (response.status === 404) return { state: "notfound" as const, data: null };
    if (response.status === 401) return { state: "unauth" as const, data: null };
    const data = await response.json() as CheckinData;
    return {
      state: data.registration ? "ready" as const : "unregistered" as const,
      data,
    };
  }, [eventId, shortCode, registrationId]);

  const {
    data: loaded,
    setData: setCheckinData,
    reload,
  } = useApiResource<{
    state: LoadState;
    data: CheckinData | null;
  }>(fetchCheckin, { key: `${eventId}:${shortCode ?? ""}:${registrationId ?? ""}:${status}` });
  const loadState = loaded?.state ?? "loading";
  const data = loaded?.data ?? null;
  const setData = (update: (current: CheckinData | null) => CheckinData | null) => {
    setCheckinData((current) => {
      const next = update(current?.data ?? null);
      return next ? { state: current?.state ?? "ready", data: next } : current;
    });
  };

  // A page left open before the window should open itself, without a manual
  // refresh. A silent reload every minute picks up the server's new state.
  useEffect(() => {
    if (!data?.registration || data.registration.checkedInAt) return;
    const timer = window.setInterval(() => { void reload({ silent: true }); }, 60_000);
    return () => window.clearInterval(timer);
  }, [data?.registration, reload]);

  const doCheckIn = async () => {
    setError("");
    setCheckingIn(true);
    try {
      const res = await fetch(`/api/checkin/${eventId}`, {
        method: "POST",
        headers: registrationId ? { "Content-Type": "application/json" } : undefined,
        body: registrationId ? JSON.stringify({ registrationId }) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Something went wrong.");
        if (d.checkIn) {
          setData((prev) => prev ? { ...prev, checkIn: d.checkIn as CheckInInfo } : prev);
        }
        return;
      }
      setData((prev) => prev && prev.registration
        ? { ...prev, registration: { ...prev.registration, checkedInAt: d.checkedInAt } }
        : prev);
    } catch {
      setError("Could not check in. Check your connection.");
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-darker">
      <div className="max-w-[480px] mx-auto px-4 py-12 sm:py-16">
        {loadState === "loading" && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[13px] text-muted">Loading check-in…</p>
          </div>
        )}

        {loadState === "notfound" && (
          <StateCard
            icon={<AlertCircle className="w-8 h-8 text-red-300" />}
            title="Check-in link not found"
            body="This link doesn&apos;t match a live event. Double-check the QR code with the organiser."
          />
        )}

        {loadState === "unregistered" && (
          <StateCard
            icon={<AlertCircle className="w-8 h-8 text-amber-300" />}
            title="You&apos;re not registered for this event"
            body="This check-in code is for a specific event, and your account has no registration for it. If you believe this is a mistake, contact the organiser."
          />
        )}

        {loadState === "unauth" && (
          <StateCard
            icon={<LogIn className="w-8 h-8 text-primary" />}
            title="Sign in to check in"
            body="Check-in is tied to your Startline account, so you can only confirm your own attendance."
            action={
              <Button variant="default" className="w-full" onClick={() => setIsSignInOpen(true)}>
                <LogIn className="w-4 h-4" /> Sign in
              </Button>
            }
          />
        )}

        {loadState === "ready" && data && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-headline text-2xl font-black italic tracking-tighter text-white mb-1">
                {data.registration!.checkedInAt ? "You're checked in" : "Check in to this event"}
              </h1>
              <p className="text-[13px] text-muted">{data.event.title}</p>
            </div>

            <div className="bg-dark rounded-xl border border-dark-lighter p-5">
              <div className="font-headline text-[14px] font-bold text-white">{data.registration!.athleteName}</div>
              <div className="flex flex-col gap-1 mt-3 text-[13px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  {formatDate(data.event.eventDate, data.event.startTime)}
                  {data.registration!.waveLabel ? ` · ${data.registration!.waveLabel}` : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {data.event.venue}, {data.event.city} {data.event.state.toUpperCase()}
                </span>
                {data.registration!.bibNumber && (
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                    Bib {data.registration!.bibNumber}
                  </span>
                )}
              </div>
            </div>

            {data.registration!.checkedInAt ? (
              <div className="flex items-center justify-center gap-2 px-4 py-4 bg-primary/10 border border-primary/30 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <div className="text-center">
                  <div className="font-headline text-[13px] font-bold text-primary">Checked in</div>
                  <div className="text-[12px] text-muted">
                    {formatTimestamp(data.registration!.checkedInAt, data.event.timeZone)}
                  </div>
                </div>
              </div>
            ) : data.checkIn.state === "open" ? (
              <>
                {error && (
                  <div className="px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg text-[12px] text-red-300 text-center">{error}</div>
                )}
                <Button variant="default" className="w-full" size="lg" onClick={doCheckIn} disabled={checkingIn}>
                  {checkingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking in…
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" /> Check In
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] text-muted-dark">
                  Tap once to confirm you&apos;re here. You can&apos;t be checked in for this event by anyone else.
                </p>
              </>
            ) : (
              <div className="px-4 py-4 bg-dark border border-dark-lighter rounded-xl text-center">
                {data.checkIn.state === "before" && data.checkIn.opensAt ? (
                  <>
                    <div className="font-headline text-[13px] font-bold text-light">Check-in isn&apos;t open yet</div>
                    <div className="text-[12px] text-muted mt-1">
                      Opens {formatCheckInWindow(data.checkIn.opensAt, data.event.timeZone)}.
                    </div>
                  </>
                ) : data.checkIn.state === "closed" ? (
                  <>
                    <div className="font-headline text-[13px] font-bold text-light">Check-in is closed</div>
                    <div className="text-[12px] text-muted mt-1">
                      This event has ended. Contact the organiser if you need help.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-headline text-[13px] font-bold text-light">Check-in isn&apos;t available</div>
                    <div className="text-[12px] text-muted mt-1">
                      The organiser hasn&apos;t opened check-in for this event.
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="text-center">
              <Link href="/activity" className="text-[13px] text-primary hover:underline">Back to your activity</Link>
            </div>
          </div>
        )}
      </div>

      <SignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={() => setIsSignInOpen(false)}
      />
    </main>
  );
}

function StateCard({
  icon, title, body, action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10">
      <div className="w-14 h-14 rounded-2xl bg-dark-light flex items-center justify-center mb-4">
        {icon}
      </div>
      <h1 className="font-headline text-xl font-black italic tracking-tighter text-white mb-2">{title}</h1>
      <p className="text-[13px] text-muted max-w-[340px] leading-relaxed mb-6">{body}</p>
      {action}
    </div>
  );
}
