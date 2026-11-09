"use client";

import { useState, use, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Megaphone, Plus, Pencil,
  MapPin, Calendar, ChevronRight, AlertCircle, Trash2, Users, QrCode, CheckCheck, Loader2,
  Download, ImageDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Skeleton, PageHeaderSkeleton, PageShellSkeleton,
} from "@/components/ui/skeleton";
import RaceManagementPanel from "@/components/organiser/RaceManagementPanel";
import EventEditLockedNotice from "@/components/organiser/EventEditLockedNotice";
import EventChangeHistory from "@/components/event/EventChangeHistory";
import PendingRevisionNotice from "@/components/event/PendingRevisionNotice";
import { organiserCanEditEvent } from "@/lib/event-edit-policy";
import RichTextEditor from "@/components/ui/RichTextEditor";
import CapacityBar from "@/components/ui/CapacityBar";
import { buildCheckInQrImage, checkInQrImageFilename } from "@/lib/check-in-qr-image";
import { stripHtml } from "@/lib/utils";
import { useApiResource } from "@/hooks/useApiResource";

interface Wave { label: string; price: string; qty?: number; sold?: number }

interface DashboardData {
  event: {
    id: string; title: string; organiserName?: string | null; discipline: string;
    status: "APPROVED" | "IN_PROGRESS";
    eventDate: string; endDate?: string | null;
    startTime: string; endTime: string;
    venue: string; city: string; state: string;
    cap?: number | null; registrationCount: number;
    checkedInCount: number;
    coverImageUrl?: string | null; waves: Wave[];
    feeStructure: string; categories: string[];
  };
  recentRegistrations: Registration[];
  announcements: Announcement[];
}

interface Registration {
  id: string;
  name: string;
  email: string;
  category: string | null;
  wave: string | null;
  gender: string | null;
  medicalNotes: string | null;
  checkedInAt: string | null;
  amount: number;
  createdAt: string;
}

interface Announcement {
  id: string; title: string; body: string; createdAt: string;
}

/** Phones show a short list so tiers and announcements stay within reach. */
const PHONE_REGISTRATIONS = 5;

function formatDate(dateStr: string, timeStr?: string) {
  try {
    const d    = new Date(dateStr + "T00:00:00");
    const date = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    if (!timeStr) return date;
    const t = new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} · ${t}`;
  } catch { return dateStr; }
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (mins < 2)  return "just now";
  if (mins < 60) return ago(mins, "minute");
  if (hours < 24) return ago(hours, "hour");
  return ago(days, "day");
}

export default function EventDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={
      <PageShellSkeleton>
        <PageHeaderSkeleton />
      </PageShellSkeleton>
    }>
      <EventDashboardInner params={params} />
    </Suspense>
  );
}

function EventDashboardInner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router  = useRouter();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const managePanel = panel === "manage";
  const announcePanel = panel === "announce";

  const setPanel = (next: "manage" | "announce" | null) => {
    router.replace(
      next
        ? `/organiser/events/${id}/dashboard?panel=${next}`
        : `/organiser/events/${id}/dashboard`,
      { scroll: false },
    );
  };

  const setManagePanel = (on: boolean) => setPanel(on ? "manage" : null);

  const fetchDashboard = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`/api/organiser/events/${id}/dashboard`, { signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Failed to load");
    return payload as DashboardData;
  }, [id]);

  const {
    data,
    loading,
    error,
    setData,
  } = useApiResource<DashboardData>(fetchDashboard, { key: id });

  const [annTitle,    setAnnTitle]      = useState("");
  const [annBody,     setAnnBody]       = useState("");
  const [posting,     setPosting]       = useState(false);
  const [postError,   setPostError]     = useState("");

  const [delAnn,    setDelAnn]    = useState<Announcement | null>(null);
  const [deleting,  setDeleting]  = useState(false);


  const [qrOpen,    setQrOpen]    = useState(false);
  const [qr,        setQr]        = useState<{ url: string; qrDataUrl: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError,   setQrError]   = useState("");
  const [copied,    setCopied]    = useState(false);
  const [imageDownloading, setImageDownloading] = useState(false);
  const [downloadError,    setDownloadError]    = useState("");

  const openCheckInQr = async () => {
    setQrOpen(true);
    setQrLoading(true);
    setQrError("");
    setDownloadError("");
    setQr(null);
    try {
      const res = await fetch(`/api/organiser/events/${id}/check-in-qr`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setQrError(d.error ?? "Failed to generate the QR code."); return; }
      setQr(d);
    } catch {
      setQrError("Failed to generate the QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  const copyLink = async () => {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const downloadQrImage = async () => {
    if (!qr) return;
    setImageDownloading(true);
    setDownloadError("");
    try {
      const blob = await buildCheckInQrImage({
        qrDataUrl: qr.qrDataUrl,
        eventTitle: data?.event.title ?? "Event",
        organiserName: data?.event.organiserName,
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = checkInQrImageFilename(data?.event.title ?? "event");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setDownloadError("Could not create the QR image. Please try again.");
    } finally {
      setImageDownloading(false);
    }
  };

  // Clear the announcement draft when the panel closes. Adjusting state during
  // render (rather than in an effect) keeps this to a single render pass — the
  // panel is derived from the URL, so an effect would repaint the stale draft first.
  const [wasAnnouncing, setWasAnnouncing] = useState(announcePanel);
  if (wasAnnouncing !== announcePanel) {
    setWasAnnouncing(announcePanel);
    if (!announcePanel) {
      setAnnTitle("");
      setAnnBody("");
      setPostError("");
    }
  }

  const postAnnouncement = async () => {
    setPostError("");
    if (!annTitle.trim()) { setPostError("Title is required."); return; }
    if (!stripHtml(annBody)) { setPostError("Message is required."); return; }
    setPosting(true);
    try {
      const res = await fetch(`/api/organiser/events/${id}/announcements`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: annTitle, body: annBody }),
      });
      const ann = await res.json() as Announcement & { error?: string };
      if (!res.ok) { setPostError(ann.error ?? "Failed to post announcement."); return; }
      setData(d => d ? { ...d, announcements: [ann, ...d.announcements] } : d);
      setAnnTitle("");
      setAnnBody("");
      setPanel(null);
    } finally {
      setPosting(false);
    }
  };

  const deleteAnnouncement = async () => {
    if (!delAnn) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/organiser/events/${id}/announcements/${delAnn.id}`, { method: "DELETE" });
      if (res.ok) {
        setData(d => d ? { ...d, announcements: d.announcements.filter(a => a.id !== delAnn.id) } : d);
        setDelAnn(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <PageShellSkeleton maxWidth="max-w-[1240px]" className="pt-14 px-4 sm:px-6">
        <Skeleton className="h-3 w-28 mb-6" />
        <PageHeaderSkeleton actions={2} />
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </PageShellSkeleton>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-dark-darker">
        <main className="pt-14">
          <div className="max-w-[1100px] mx-auto px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-300" />
            </div>
            <div className="font-headline text-xl font-black italic text-white mb-2">Unable to load dashboard</div>
            <div className="text-muted text-sm mb-6">{error || "This event's dashboard is unavailable."}</div>
            <Button variant="outline" onClick={() => router.push("/organiser/listings")}>
              <ArrowLeft className="w-4 h-4" /> Back to listings
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const { event, announcements, recentRegistrations } = data;
  const canEdit = organiserCanEditEvent(event.status);
  const location = [event.venue, event.city].map((s) => s?.trim()).filter(Boolean).join(", ");

  const stats = [
    {
      label: "Registered",
      value: (
        <>
          {event.registrationCount.toLocaleString()}
          {event.cap != null && (
            <span className="text-muted-dark font-normal"> / {event.cap.toLocaleString()}</span>
          )}
        </>
      ),
      shortLabel: "Registered",
      accent: false,
      title: undefined as string | undefined,
    },
    { label: "Checked in", shortLabel: "Checked in", value: event.checkedInCount.toLocaleString(), accent: true, title: undefined },
  ];

  return (
      <div className="min-h-screen bg-dark-darker">

      <main className="pt-14">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-12 page-in">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 font-headline text-[11px] uppercase tracking-widest text-muted-dark mb-6">
            <Link href="/organiser/listings" className="hover:text-muted transition-colors">Listings</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-muted truncate max-w-[200px]">{event.title}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary">Dashboard</span>
          </div>

          {/* Event header: identity on the left, the two actions on the right */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-6 mb-6">
            {event.coverImageUrl && (
              <div className="relative w-full sm:w-40 h-28 rounded-xl overflow-hidden shrink-0">
                <Image src={event.coverImageUrl} alt={event.title} fill className="pointer-events-none object-cover brightness-[.62] saturate-110" sizes="(max-width: 640px) 100vw, 160px" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-light">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                  Live
                </span>
                <span className="text-muted-dark" aria-hidden>·</span>
                <span className="font-headline text-[11px] uppercase tracking-widest text-muted-dark">
                  {event.discipline.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="font-headline text-[32px] lg:text-[40px] font-black italic tracking-tighter leading-none text-white mb-3">
                {event.title}
              </h1>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  {formatDate(event.eventDate, event.startTime)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {location ? `${location} ` : ""}{event.state.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row shrink-0">
              {managePanel ? (
                <Button variant="outline" type="button" className="col-span-2" onClick={() => setManagePanel(false)}>
                  <ArrowLeft className="w-4 h-4" /> Back to overview
                </Button>
              ) : (
                <>
                  <Button type="button" className="col-span-2" onClick={() => setManagePanel(true)}>
                    <Users className="w-4 h-4" /> Manage registrations
                  </Button>
                  <Button variant="outline" type="button" className={canEdit ? "" : "col-span-2"} onClick={openCheckInQr}>
                    <QrCode className="w-4 h-4" /> Check-in QR
                  </Button>
                  {canEdit && (
                    <Button variant="outline" asChild>
                      <Link href={`/organiser/new-listing?id=${event.id}&from=${encodeURIComponent(`/organiser/events/${event.id}/dashboard`)}`}>
                        <Pencil className="w-4 h-4" /> Edit event
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0 bg-dark border border-dark-lighter rounded-2xl px-3 sm:px-5 py-3 sm:py-4" title={s.title ?? s.label}>
                <div className={`font-headline text-lg sm:text-[28px] truncate font-black tracking-tighter leading-none ${s.accent ? "text-primary" : "text-light"}`}>
                  {s.value}
                </div>
                <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted mt-2 truncate">
                  <span className="sm:hidden">{s.shortLabel}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          {!managePanel && !canEdit && (
            <div className="mb-8">
              <EventEditLockedNotice eventId={id} status={event.status} compact />
            </div>
          )}

          {managePanel ? (
            <div className="mb-8">
              <RaceManagementPanel eventId={id} />
            </div>
          ) : (
          <>
          <div className="grid gap-6 lg:grid-cols-3 items-start">

          {/* Registrations: the main column */}
          <Card className="lg:col-span-2 min-w-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="font-headline text-lg font-black italic tracking-tighter text-white">
                    Registrations
                  </h2>
                  <span className="font-headline text-[13px] tabular-nums text-muted-dark">
                    {event.registrationCount.toLocaleString()}
                  </span>
                </div>
                {recentRegistrations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManagePanel(true)}
                    className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                  >
                    View all
                  </button>
                )}
              </div>

              <div className="mt-4">
                {recentRegistrations.length > 0 ? (
                  <>
                  {/* Phone: one stacked row per athlete, no sideways scroll */}
                  <ul className="sm:hidden divide-y divide-white/5">
                    {recentRegistrations.slice(0, PHONE_REGISTRATIONS).map((r) => (
                      <li key={r.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-headline text-[14px] font-bold text-white/90 truncate">{r.name}</span>
                            {r.medicalNotes && (
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-300" aria-label={`Medical: ${r.medicalNotes}`} />
                            )}
                          </div>
                          <div className="text-[12px] text-muted-dark truncate">
                            {[r.wave, timeAgo(r.createdAt)].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-headline text-[13px] font-black italic text-white whitespace-nowrap">{fmt(r.amount)}</div>
                          {r.checkedInAt && (
                            <div className="inline-flex items-center gap-1 mt-0.5 font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
                              <CheckCheck className="w-3 h-3" /> In
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {event.registrationCount > PHONE_REGISTRATIONS && (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="sm:hidden w-full mt-2"
                      onClick={() => setManagePanel(true)}
                    >
                      View all {event.registrationCount.toLocaleString()} registrations
                    </Button>
                  )}
                  <div className="hidden sm:block overflow-x-auto -mx-2">
                    <table className="w-full min-w-[520px] border-collapse">
                      <thead>
                        <tr className="border-b border-white/5">
                          {["Athlete", "Wave", "Registered", "Paid", "Check-in"].map((h) => (
                            <th key={h} className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark text-left px-2 py-2 last:text-right">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentRegistrations.map((r) => (
                          <tr key={r.id} className="border-b border-white/5 last:border-0">
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-headline text-[14px] font-bold text-white/90 truncate max-w-[200px]">{r.name}</span>
                                {r.medicalNotes && (
                                  <span
                                    title={`Medical: ${r.medicalNotes}`}
                                    className="shrink-0 inline-flex items-center gap-1 font-headline text-[9px] font-bold uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5"
                                  >
                                    <AlertCircle className="w-2.5 h-2.5" /> Medical
                                  </span>
                                )}
                              </div>
                              {r.email !== r.name && (
                                <div className="text-[12px] text-muted-dark truncate max-w-[220px]">{r.email}</div>
                              )}
                            </td>
                            <td className="px-2 py-3">
                              {r.wave
                                ? <span className="font-headline text-[12px] text-muted-light">{r.wave}</span>
                                : <span className="text-[12px] text-muted-dark">—</span>}
                            </td>
                            <td className="px-2 py-3 text-[12px] text-muted-light whitespace-nowrap">{timeAgo(r.createdAt)}</td>
                            <td className="px-2 py-3 font-headline text-[13px] font-black italic text-white text-right whitespace-nowrap">{fmt(r.amount)}</td>
                            <td className="px-2 py-3 text-right">
                              {r.checkedInAt ? (
                                <span className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/30 rounded px-1.5 py-0.5 whitespace-nowrap">
                                  <CheckCheck className="w-3 h-3" /> {timeAgo(r.checkedInAt)}
                                </span>
                              ) : (
                                <span className="text-[12px] text-muted-dark">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {event.registrationCount > recentRegistrations.length && (
                    <p className="hidden sm:block text-[11px] text-muted-dark mt-3">
                      Showing the {recentRegistrations.length} most recent of {event.registrationCount.toLocaleString()}.
                    </p>
                  )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 mx-auto mb-3 text-muted-dark" />
                    <div className="font-headline text-sm font-bold uppercase tracking-widest text-muted mb-1">No registrations yet</div>
                    <div className="text-[13px] text-muted-dark">Athletes who register will appear here.</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar: tiers and announcements */}
          <div className="space-y-6">
            {event.waves.length > 0 && (
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-headline text-lg font-black italic tracking-tighter text-white">
                      Ticket tiers
                    </h2>
                    <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">Sold / Cap</span>
                  </div>
                  <div className="divide-y divide-white/5 mt-3">
                    {event.waves.map((w, i) => {
                      const sold = w.sold ?? 0;
                      const capped = w.qty != null;
                      return (
                        <div key={i} className="py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-headline text-[14px] font-bold text-white/90 truncate">{w.label}</div>
                              <div className="font-headline text-[12px] italic text-muted">A${w.price}</div>
                            </div>
                            <div className="font-headline text-[13px] text-muted-light shrink-0">
                              {sold.toLocaleString()}
                              {capped ? ` / ${w.qty!.toLocaleString()}` : ""}
                            </div>
                          </div>
                          {capped && (
                            <CapacityBar
                              count={sold}
                              cap={w.qty}
                              className="mt-2 w-full"
                              label={`${w.label}: ${sold} of ${w.qty} sold`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2.5">
                    <h2 className="font-headline text-lg font-black italic tracking-tighter text-white">
                      Announcements
                    </h2>
                    {announcements.length > 0 && (
                      <span className="font-headline text-[13px] tabular-nums text-muted-dark">{announcements.length}</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    aria-label="New announcement"
                    onClick={() => setPanel("announce")}
                  >
                    <Plus className="w-3.5 h-3.5" /> New
                  </Button>
                </div>

                {announcements.length === 0 ? (
                  <p className="mt-4 text-[13px] text-muted-dark">
                    No announcements yet. Post one to notify registered athletes.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {announcements.map(ann => (
                      <div key={ann.id} className="p-3 bg-dark-light border border-dark-lighter rounded-xl">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-headline text-[14px] font-bold text-white">{ann.title}</div>
                            <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-0.5">{timeAgo(ann.createdAt)}</div>
                          </div>
                          <button
                            onClick={() => setDelAnn(ann)}
                            className="shrink-0 text-muted-dark hover:text-red-400 transition-colors mt-0.5"
                            title="Delete announcement"
                            aria-label={`Delete announcement ${ann.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-[13px] text-muted-light mt-1.5 leading-relaxed line-clamp-2">
                          {stripHtml(ann.body)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          </div>

          {/* Live events open here rather than on the event page, so the
              record of what changed has to be here too. */}
          <div className="mt-8">
            <PendingRevisionNotice eventId={id} />
            <EventChangeHistory eventId={id} apiBase="/api/organiser" />
          </div>
          </>
          )}

        </div>
      </main>

      {/* New announcement: driven by ?panel=announce so the link stays shareable */}
      <Dialog open={announcePanel} onOpenChange={open => { if (!open) setPanel(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle>New announcement</DialogTitle>
            </div>
            <DialogDescription>
              Notify registered athletes about schedule changes, logistics, or event updates.
            </DialogDescription>
          </DialogHeader>
          {postError && (
            <div className="px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg text-[12px] text-red-300">{postError}</div>
          )}
          <div className="space-y-3">
            <div>
              <label htmlFor="announcement-title" className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">Title</label>
              <input
                id="announcement-title"
                type="text"
                value={annTitle}
                onChange={e => setAnnTitle(e.target.value)}
                placeholder="e.g. Schedule update — Saturday heat times"
                className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">Message</label>
              <RichTextEditor
                value={annBody}
                onChange={setAnnBody}
                placeholder="Write your announcement here…"
                editorClassName="min-h-[180px] bg-dark"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPanel(null)}>Cancel</Button>
            <Button onClick={postAnnouncement} disabled={posting}>
              {posting ? "Posting…" : "Post announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-in QR */}
      <Dialog open={qrOpen} onOpenChange={open => { if (!open) setQrOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle>Check-in QR</DialogTitle>
            </div>
            <DialogDescription>
              Display this QR on a screen or print the A4 poster at the gate. Athletes scan it with their phone camera to check themselves in.
            </DialogDescription>
          </DialogHeader>

          {qrLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-[13px] text-muted">Generating QR code…</p>
            </div>
          ) : qrError ? (
            <div className="px-3 py-3 bg-red-400/10 border border-red-400/20 rounded-lg text-[13px] text-red-300">{qrError}</div>
          ) : qr ? (
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.qrDataUrl}
                alt={`Check-in QR code for ${event.title}`}
                className="w-56 h-56 rounded-lg border border-dark-lighter"
              />
              <div className="mt-4 w-full flex items-center gap-2">
                <input
                  readOnly
                  value={qr.url}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 bg-dark border border-dark-lighter rounded-lg px-3 py-2 text-[12px] text-muted-light focus:border-primary focus:outline-none"
                />
                <Button variant="outline" type="button" className="shrink-0" onClick={copyLink}>
                  {copied ? <CheckCheck className="w-4 h-4" /> : "Copy"}
                </Button>
              </div>
              <div className="mt-4 grid w-full gap-2 sm:grid-cols-2">
                <Button variant="outline" asChild>
                  <a
                    href={`/api/organiser/events/${id}/check-in-qr/pdf`}
                    download
                  >
                    <Download className="w-4 h-4" /> Download A4 PDF
                  </a>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={downloadQrImage}
                  disabled={imageDownloading}
                >
                  {imageDownloading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ImageDown className="w-4 h-4" />}
                  {imageDownloading ? "Preparing…" : "Download QR image"}
                </Button>
              </div>
              {downloadError && (
                <div className="mt-3 w-full px-3 py-2 bg-red-400/10 border border-red-400/20 rounded-lg text-[12px] text-red-300">
                  {downloadError}
                </div>
              )}
              <div className="mt-4 w-full text-center font-headline text-[11px] uppercase tracking-widest text-muted">
                {event.checkedInCount} of {event.registrationCount} checked in
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete announcement confirm */}
      <Dialog open={!!delAnn} onOpenChange={open => { if (!open) setDelAnn(null); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-300" />
              </div>
              <DialogTitle>Delete this announcement?</DialogTitle>
            </div>
            <DialogDescription>
              &ldquo;{delAnn?.title}&rdquo; will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelAnn(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAnnouncement} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
