"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, DollarSign, Megaphone, Plus, Pencil,
  MapPin, Calendar, ChevronRight, AlertCircle, Send, Trash2, Users
} from "lucide-react";
import OrganiserTopBar from "@/components/organiser/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Wave { label: string; price: string; qty?: number }

interface DashboardData {
  event: {
    id: string; title: string; discipline: string;
    eventDate: string; endDate?: string | null;
    startTime: string; endTime: string;
    venue: string; city: string; state: string;
    cap?: number | null; registrationCount: number;
    coverImageUrl?: string | null; waves: Wave[];
    feeStructure: string; categories: string[];
  };
  payout: {
    registrationCount: number; lowestTicketPrice: number;
    grossRevenue: number; platformFees: number;
    estimatedPayout: number; feeStructure: string; note: string;
  };
  announcements: Announcement[];
}

interface Announcement {
  id: string; title: string; body: string; createdAt: string;
}

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
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function EventDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router  = useRouter();

  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Announcement composer
  const [showCompose, setShowCompose]   = useState(false);
  const [annTitle,    setAnnTitle]      = useState("");
  const [annBody,     setAnnBody]       = useState("");
  const [posting,     setPosting]       = useState(false);
  const [postError,   setPostError]     = useState("");

  // Delete announcement
  const [delAnn,    setDelAnn]    = useState<Announcement | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  useEffect(() => {
    fetch(`/api/organiser/events/${id}/dashboard`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error ?? "Failed to load")))
      .then((d: DashboardData) => setData(d))
      .catch((e: string) => setError(e))
      .finally(() => setLoading(false));
  }, [id]);

  const postAnnouncement = async () => {
    setPostError("");
    if (!annTitle.trim()) { setPostError("Title is required."); return; }
    if (!annBody.trim())  { setPostError("Message is required."); return; }
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
      setShowCompose(false);
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
      <div className="min-h-screen bg-gray-50">
        <OrganiserTopBar />
        <main className="pt-14">
          <div className="max-w-[1100px] mx-auto px-6 py-16 text-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OrganiserTopBar />
        <main className="pt-14">
          <div className="max-w-[1100px] mx-auto px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div className="font-headline text-xl font-black italic text-gray-900 mb-2">Unable to load dashboard</div>
            <div className="text-gray-500 text-sm mb-6">{error || "This event's dashboard is unavailable."}</div>
            <Button variant="outline" onClick={() => router.push("/organiser/listings")}>
              <ArrowLeft className="w-4 h-4" /> Back to listings
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const { event, payout, announcements } = data;
  const capacityPct = event.cap ? Math.min(100, Math.round((event.registrationCount / event.cap) * 100)) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-14">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-12 page-in">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 font-headline text-[11px] uppercase tracking-widest text-gray-400 mb-6">
            <Link href="/organiser/listings" className="hover:text-gray-700 transition-colors">Listings</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700 truncate max-w-[200px]">{event.title}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-lime-600">Dashboard</span>
          </div>

          {/* Event header */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 mb-8">
            {event.coverImageUrl && (
              <div className="w-full lg:w-48 h-32 lg:h-32 rounded-xl overflow-hidden shrink-0">
                <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className="bg-lime-50 text-lime-700 border-0">
                  Live
                </Badge>
                <span className="font-headline text-[11px] uppercase tracking-widest text-gray-400">
                  {event.discipline.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="font-headline text-[36px] lg:text-[44px] font-black italic tracking-tighter leading-none text-gray-900 mb-3">
                {event.title}
              </h1>
              <div className="flex flex-col gap-1 text-[13px] text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-lime-500 shrink-0" />
                  {formatDate(event.eventDate, event.startTime)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-lime-500 shrink-0" />
                  {event.venue}, {event.city} {event.state.toUpperCase()}
                </span>
              </div>
            </div>
            <Button variant="outline" asChild className="shrink-0">
              <Link href={`/organiser/new-listing?id=${event.id}`}>
                <Pencil className="w-4 h-4" /> Edit event
              </Link>
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Registrations */}
            <Card className="flex-1">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Registered</div>
                  <div className="font-headline text-2xl font-black italic tracking-tighter text-gray-900">
                    {event.registrationCount.toLocaleString()}
                    {event.cap && <span className="text-gray-400 font-normal text-lg"> / {event.cap.toLocaleString()}</span>}
                  </div>
                  {capacityPct !== null && (
                    <div className="mt-2 h-1 w-32 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${capacityPct >= 90 ? "bg-red-500" : capacityPct >= 70 ? "bg-amber-500" : "bg-lime-500"}`}
                        style={{ width: `${capacityPct}%` }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Estimated payout */}
            <Card className="flex-1">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Estimated payout</div>
                  <div className="font-headline text-2xl font-black italic tracking-tighter text-gray-900">
                    {fmt(payout.estimatedPayout)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">after platform fees</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ticket tiers */}
          {event.waves.length > 0 && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-headline text-lg font-black italic tracking-tighter text-gray-900">
                    Ticket tiers
                  </h2>
                  <span className="font-headline text-[10px] uppercase tracking-widest text-gray-400">
                    {event.registrationCount} total sold
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {event.waves.map((w, i) => (
                    <div key={i} className="flex items-center justify-between py-3 gap-4">
                      <div className="font-headline text-[14px] font-bold text-gray-800 min-w-0 truncate">{w.label}</div>
                      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                        <div className="font-headline text-[14px] font-black italic text-gray-900">A${w.price}</div>
                        <div className="text-right">
                          <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400">Cap</div>
                          <div className="font-headline text-[13px] text-gray-600">{w.qty ? w.qty.toLocaleString() : "—"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-[11px] text-gray-400">
                    Per-tier sales tracking will be available once the registration system is live.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Registrations placeholder */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline text-lg font-black italic tracking-tighter text-gray-900">
                  Registrations
                </h2>
                <Badge className="bg-gray-100 text-gray-600 border-0">
                  {event.registrationCount.toLocaleString()} total
                </Badge>
              </div>

              {event.registrationCount > 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                  <div className="font-headline text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">
                    {event.registrationCount} athlete{event.registrationCount !== 1 ? "s" : ""} registered
                  </div>
                  <div className="text-[13px] text-gray-400">
                    Individual registration records will appear here in a future update.
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                  <div className="font-headline text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">No registrations yet</div>
                  <div className="text-[13px] text-gray-400">Athletes who register will appear here.</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-headline text-lg font-black italic tracking-tighter text-gray-900">
                    Announcements
                  </h2>
                  <p className="text-[13px] text-gray-400 mt-0.5 max-w-sm">
                    Keep registered athletes in the loop about schedule changes, logistics, or event updates.
                  </p>
                </div>
                <Button onClick={() => setShowCompose(true)} className="shrink-0 self-start">
                  <Plus className="w-4 h-4" /> New announcement
                </Button>
              </div>

              {/* Compose panel */}
              {showCompose && (
                <div className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-gray-700 mb-4 flex items-center gap-2">
                    <Megaphone className="w-4 h-4" /> New announcement
                  </div>
                  {postError && (
                    <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">{postError}</div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-600 block mb-1.5">Title</label>
                      <input
                        type="text"
                        value={annTitle}
                        onChange={e => setAnnTitle(e.target.value)}
                        placeholder="e.g. Schedule update — Saturday heat times"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-600 block mb-1.5">Message</label>
                      <textarea
                        rows={4}
                        value={annBody}
                        onChange={e => setAnnBody(e.target.value)}
                        placeholder="Write your announcement here…"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none resize-none transition-colors"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button variant="ghost" onClick={() => { setShowCompose(false); setAnnTitle(""); setAnnBody(""); setPostError(""); }}>
                        Cancel
                      </Button>
                      <Button onClick={postAnnouncement} disabled={posting}>
                        {posting ? "Posting…" : <><Send className="w-4 h-4" /> Post announcement</>}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Announcement list */}
              {announcements.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Megaphone className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="font-headline text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">No announcements yet</div>
                  <div className="text-[13px] text-gray-400">Post an update to notify registered athletes.</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map(ann => (
                    <div key={ann.id} className="flex items-start gap-4 p-4 bg-white border border-gray-100 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-lime-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Megaphone className="w-4 h-4 text-lime-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-headline text-[14px] font-bold text-gray-900">{ann.title}</div>
                          <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400 shrink-0">{timeAgo(ann.createdAt)}</div>
                        </div>
                        <p className="text-[13px] text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap">{ann.body}</p>
                      </div>
                      <button
                        onClick={() => setDelAnn(ann)}
                        className="shrink-0 text-gray-300 hover:text-red-500 transition-colors mt-0.5"
                        title="Delete announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>

      {/* Delete announcement confirm */}
      <Dialog open={!!delAnn} onOpenChange={open => { if (!open) setDelAnn(null); }}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
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
