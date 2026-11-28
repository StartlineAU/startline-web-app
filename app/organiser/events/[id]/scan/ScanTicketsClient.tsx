"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Camera, CheckCircle2, Keyboard, Loader2, QrCode,
  RefreshCw, ScanLine, UserCheck,
} from "lucide-react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks/useApiResource";

type CheckInState = "before" | "open" | "closed" | "unavailable";

interface ScanEventData {
  event: {
    id: string;
    title: string;
    status: string;
    checkIn: {
      state: CheckInState;
      opensAt: string | null;
      closesAt: string | null;
    };
  };
  counts: { confirmed: number; checkedIn: number };
}

interface ScanRegistration {
  id: string;
  athleteName: string;
  waveLabel: string | null;
  bibNumber: string | null;
  teamName: string | null;
  checkedInAt: string | null;
  status: string;
}

interface ScanResponse {
  result?: "checked_in" | "already_checked_in";
  checkedInAt?: string;
  registration?: ScanRegistration | null;
  error?: string;
  code?: string;
  checkIn?: ScanEventData["event"]["checkIn"];
}

interface ScanOutcome {
  tone: "success" | "already" | "error";
  title: string;
  detail: string;
  registration?: ScanRegistration | null;
}

const RELEASE_MS = 250;
const SAME_TICKET_COOLDOWN_MS = 2_000;

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}

function outcomeFromResponse(payload: ScanResponse, ok: boolean): ScanOutcome {
  const name = payload.registration?.athleteName ?? "This entry";

  if (ok && payload.result === "checked_in") {
    return {
      tone: "success",
      title: "Checked in",
      detail: [name, payload.registration?.teamName ? `Team ${payload.registration.teamName}` : null]
        .filter(Boolean)
        .join(" · "),
      registration: payload.registration,
    };
  }

  if (ok && payload.result === "already_checked_in") {
    return {
      tone: "already",
      title: "Already checked in",
      detail: `${name} was checked in${payload.checkedInAt ? ` at ${formatTime(payload.checkedInAt)}` : " earlier"}.`,
      registration: payload.registration,
    };
  }

  return {
    tone: "error",
    title:
      payload.code === "CHECK_IN_BEFORE"
        ? "Check-in not open"
        : payload.code === "CHECK_IN_CLOSED"
          ? "Check-in closed"
          : payload.code === "NOT_ACTIVE"
            ? "Entry not active"
            : payload.code === "DETAILS_PENDING"
              ? "Details needed"
              : "Ticket not accepted",
    detail: payload.error ?? "Could not check in this ticket.",
    registration: payload.registration,
  };
}

export default function ScanTicketsClient({ eventId }: { eventId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef({ value: "", at: 0 });

  const [cameraError, setCameraError] = useState("");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  const fetchEvent = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`/api/organiser/events/${encodeURIComponent(eventId)}/scan`, {
      signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load this event.");
    return payload as ScanEventData;
  }, [eventId]);

  const { data, loading, error: loadError, reload, setData } = useApiResource<ScanEventData>(
    fetchEvent,
    { key: eventId },
  );

  const handleScan = useCallback(
    async (rawValue: string) => {
      const value = rawValue.trim();
      if (!value || busyRef.current) return;

      const now = Date.now();
      if (
        value === lastScanRef.current.value &&
        now - lastScanRef.current.at < SAME_TICKET_COOLDOWN_MS
      ) {
        return;
      }

      busyRef.current = true;
      lastScanRef.current = { value, at: now };
      setBusy(true);
      setOutcome(null);

      try {
        const response = await fetch(
          `/api/organiser/events/${encodeURIComponent(eventId)}/scan`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qr: value }),
          },
        );
        const payload = (await response.json()) as ScanResponse;
        const next = outcomeFromResponse(payload, response.ok);
        setOutcome(next);

        if (response.ok && payload.result === "checked_in") {
          setData((current) =>
            current
              ? {
                  ...current,
                  counts: {
                    ...current.counts,
                    checkedIn: Math.min(current.counts.confirmed, current.counts.checkedIn + 1),
                  },
                }
              : current,
          );
          navigator.vibrate?.(80);
        } else if (next.tone === "already") {
          navigator.vibrate?.([50, 50, 50]);
        } else {
          navigator.vibrate?.([120, 60, 120]);
        }
      } catch {
        setOutcome({
          tone: "error",
          title: "Connection problem",
          detail: "The scan did not reach Startline. Check the signal and scan again.",
        });
      } finally {
        window.setTimeout(() => {
          busyRef.current = false;
          setBusy(false);
        }, RELEASE_MS);
      }
    },
    [eventId, setData],
  );

  const checkInOpen = data?.event.checkIn.state === "open";

  useEffect(() => {
    if (!checkInOpen || !videoRef.current) return;

    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result) => {
          if (!cancelled && result) void handleScan(result.getText());
        },
      )
      .then((controls) => {
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError(
            "Could not start the camera. Give the browser camera permission, or enter the ticket code below.",
          );
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [checkInOpen, handleScan]);

  if (loading) {
    return (
      <main className="min-h-screen bg-dark-darker">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading scanner…
        </div>
      </main>
    );
  }

  if (loadError || !data) {
    return (
      <main className="min-h-screen bg-dark-darker">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <AlertCircle className="mx-auto h-9 w-9 text-red-300" />
          <h1 className="mt-4 font-headline text-2xl font-black italic tracking-tight text-light">
            Scanner unavailable
          </h1>
          <p className="mt-2 text-[13px] text-muted">{loadError || "This event could not be loaded."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => void reload()}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/organiser/events/${eventId}/dashboard`}>
                <ArrowLeft className="h-4 w-4" /> Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark-darker">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <Link
          href={`/organiser/events/${eventId}/dashboard`}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
              Gate check-in
            </p>
            <h1 className="mt-1 font-headline text-3xl font-black italic tracking-tighter text-light sm:text-4xl">
              Scan tickets.
            </h1>
            <p className="mt-2 text-[13px] text-muted">{data.event.title}</p>
          </div>
          <div className="rounded-xl border border-dark-lighter bg-dark px-4 py-3 text-right">
            <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark">
              Checked in
            </p>
            <p className="mt-1 font-headline text-3xl font-black leading-none text-primary">
              {data.counts.checkedIn}
              <span className="ml-1 text-base text-muted">/ {data.counts.confirmed}</span>
            </p>
          </div>
        </div>

        {!checkInOpen ? (
          <div className="mt-8 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-6">
            <AlertCircle className="h-6 w-6 text-amber-300" />
            <h2 className="mt-3 font-headline text-lg font-bold text-light">
              {data.event.checkIn.state === "before" ? "Check-in is not open yet" : "Check-in is closed"}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {data.event.checkIn.state === "before" && data.event.checkIn.opensAt
                ? `Scanning opens at ${new Date(data.event.checkIn.opensAt).toLocaleString("en-AU")}. You can open check-in earlier from the event dashboard.`
                : data.event.checkIn.state === "closed"
                  ? "This event has ended, so attendance can no longer be recorded."
                  : "This event is not currently available for check-in."}
            </p>
            <Button className="mt-5" variant="outline" asChild>
              <Link href={`/organiser/events/${eventId}/dashboard?panel=manage`}>
                Open event dashboard
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="overflow-hidden rounded-2xl border border-dark-lighter bg-black">
              <div className="relative aspect-[4/3] w-full">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  aria-label="Ticket scanner camera"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                  <div className="relative aspect-square w-full max-w-[17rem] rounded-2xl border-2 border-primary/80">
                    <span className="absolute -top-px left-8 right-8 h-0.5 bg-primary" />
                  </div>
                </div>
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-dark-lighter px-4 py-3 text-[12px] text-muted">
                <Camera className="h-4 w-4 shrink-0 text-primary" />
                Hold the athlete&apos;s ticket QR inside the frame.
              </div>
            </section>

            <aside className="space-y-3">
              {cameraError ? (
                <div className="rounded-xl border border-red-300/30 bg-red-400/10 p-4 text-[12px] leading-relaxed text-red-200">
                  {cameraError}
                </div>
              ) : null}

              {outcome ? (
                <div
                  className={`rounded-2xl border p-4 ${
                    outcome.tone === "success"
                      ? "border-primary/40 bg-primary/10"
                      : outcome.tone === "already"
                        ? "border-amber-300/40 bg-amber-400/10"
                        : "border-red-300/40 bg-red-400/10"
                  }`}
                  role="status"
                >
                  <div className="flex items-start gap-3">
                    {outcome.tone === "success" ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    ) : outcome.tone === "already" ? (
                      <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                    )}
                    <div className="min-w-0">
                      <p className="font-headline text-[14px] font-bold text-light">{outcome.title}</p>
                      <p className="mt-1 break-words text-[12px] leading-relaxed text-muted">
                        {outcome.detail}
                      </p>
                      {outcome.registration ? (
                        <p className="mt-2 font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
                          {[
                            outcome.registration.waveLabel ? `Wave ${outcome.registration.waveLabel}` : null,
                            outcome.registration.bibNumber ? `Bib ${outcome.registration.bibNumber}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Entry found"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dark-lighter bg-dark p-4">
                  <ScanLine className="h-5 w-5 text-primary" />
                  <p className="mt-3 font-headline text-[13px] font-bold text-light">Ready to scan</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Each athlete has their own QR. Team members check in separately.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-dark-lighter bg-dark p-4">
                <button
                  type="button"
                  onClick={() => setManualOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light"
                >
                  <span className="inline-flex items-center gap-2">
                    <Keyboard className="h-4 w-4 text-primary" /> Enter code
                  </span>
                  <span className="text-muted-dark">{manualOpen ? "Hide" : "Show"}</span>
                </button>
                {manualOpen ? (
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = manual.trim();
                      void handleScan(value.startsWith("SLT1:") ? value : `SLT1:${value}`);
                      setManual("");
                    }}
                  >
                    <input
                      value={manual}
                      onChange={(event) => setManual(event.target.value)}
                      placeholder="Paste ticket code"
                      aria-label="Ticket code"
                      className="w-full rounded-lg border border-dark-lighter bg-dark-darker px-3 py-2 font-mono text-[12px] text-light outline-none focus:border-primary"
                    />
                    <Button type="submit" className="w-full" disabled={!manual.trim() || busy}>
                      Check in
                    </Button>
                  </form>
                ) : null}
              </div>
            </aside>
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-muted-dark">
          <QrCode className="h-3.5 w-3.5" /> Only confirmed entries for this event are accepted.
        </p>
      </div>
    </main>
  );
}
