"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus, MapPin, ArrowRight, CheckCircle, Globe, Instagram,
  Phone, Mail, X, Edit2, Camera, CalendarDays, ChevronRight,
  Star, ImageIcon,
} from "lucide-react";

import OrganiserTopBar from "@/components/organiser/TopBar";
import EventCarousel, { type CarouselEvent } from "@/components/organiser/EventCarousel";
import ReviewsSection,  { type Review }        from "@/components/organiser/ReviewsSection";
import PhotoCarousel from "@/components/organiser/PhotoCarousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null; isPinned?: boolean;
}

interface Profile {
  orgName: string; contactName: string; phone: string; contactEmail: string;
  website: string; instagram: string; facebook: string; bio: string; abn: string;
  logoUrl: string;
}

const EMPTY: Profile = {
  orgName: "", contactName: "", phone: "", contactEmail: "",
  website: "", instagram: "", facebook: "", bio: "", abn: "", logoUrl: "",
};

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string }> = {
  APPROVED: { bg: "bg-lime-50",   text: "text-lime-700",  dot: "bg-lime-500",  label: "LIVE"     },
  PENDING:  { bg: "bg-blue-50",   text: "text-blue-600",  dot: "bg-blue-500",  label: "PENDING"  },
  DRAFT:    { bg: "bg-gray-100",  text: "text-gray-500",  dot: "bg-gray-400",  label: "DRAFT"    },
  REJECTED: { bg: "bg-red-50",    text: "text-red-600",   dot: "bg-red-500",   label: "REJECTED" },
  ARCHIVED: { bg: "bg-gray-100",  text: "text-gray-400",  dot: "bg-gray-300",  label: "ARCHIVED" },
};

function formatEventDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return { day: d.getDate(), month: d.toLocaleString("en-AU", { month: "short" }).toUpperCase() };
  } catch { return { day: "—", month: "" }; }
}

function isUpcoming(dateStr: string) {
  try { return new Date(dateStr) >= new Date(); } catch { return true; }
}

function EventCard({ e }: { e: EventRow }) {
  const s    = STATUS_STYLE[e.status];
  const date = formatEventDate(e.eventDate);
  const cap  = e.cap ?? 0;

  return (
    <Card className="overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
      <div className="relative h-24 overflow-hidden bg-gray-100">
        {e.coverImageUrl ? (
          <img src={e.coverImageUrl} alt={e.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute top-2 left-2">
          <Badge className={`gap-1.5 ${s.bg} ${s.text} border-0 text-[9px] px-1.5 py-0.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${e.status === "APPROVED" ? "animate-pulse-dot" : ""}`} />
            {s.label}
          </Badge>
        </div>
        {date.day !== "—" && (
          <div className="absolute bottom-2 right-2 text-right">
            <div className="font-headline text-[9px] uppercase tracking-widest text-white/70">{date.month}</div>
            <div className="font-headline text-2xl font-black italic leading-none text-white">{date.day}</div>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400 mb-1">{e.discipline}</div>
        <div className="font-headline text-[16px] font-black italic tracking-tighter text-gray-900 leading-tight mb-1.5 line-clamp-2">{e.title}</div>
        <div className="flex items-center gap-1 font-headline text-[11px] text-gray-400 uppercase tracking-widest mb-4">
          <MapPin className="w-3 h-3 text-lime-500 shrink-0" /> {e.city}, {e.state.toUpperCase()}
        </div>

        {cap > 0 ? (
          <div className="mt-auto mb-4">
            <div className="flex items-center justify-between font-headline text-[11px] uppercase tracking-widest mb-1.5">
              <span className="text-gray-900 font-bold">0 signed up</span>
              <span className="text-gray-400">of {cap}</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-lime-400" style={{ width: "0%" }} />
            </div>
          </div>
        ) : (
          <div className="mt-auto mb-4" />
        )}

        <div className="pt-3 border-t border-gray-100">
          <button className="w-full flex items-center justify-between font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors group">
            View event <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </Card>
  );
}

// Edit Profile slide-over â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const STATES = [
  ["nsw","NSW"],["vic","VIC"],["qld","QLD"],["wa","WA"],
  ["sa","SA"],["tas","TAS"],["act","ACT"],["nt","NT"],
] as const;


function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-700">
        {label} {required && <span className="text-lime-600">*</span>}
      </label>
      {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-gray-400">{hint}</span>}
    </div>
  );
}

const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-lime-500 focus:outline-none transition-colors";
const FInput = ({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`${inputCls} ${className}`} />
);
const FTextarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-lime-500 focus:outline-none transition-colors resize-none" />
);

interface EditPanelProps {
  profile: Profile; state: string;
  saving: boolean; saved: boolean; error: string;
  onChange: (patch: Partial<Profile>) => void;
  onStateChange: (s: string) => void;
  onSave: () => void; onClose: () => void;
}

function EditPanel({ profile, state, saving, saved, error, onChange, onStateChange, onSave, onClose }: EditPanelProps) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm overlay-in" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] bg-white border-l border-gray-200 flex flex-col modal-in overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div>
            <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900">Edit Profile</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">Changes are reflected on your public listing page.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-lime-400" /> Organisation
            </div>
            <div className="space-y-4">
              <div><FieldLabel label="Organisation name" required /><FInput value={profile.orgName} onChange={e => onChange({ orgName: e.target.value })} placeholder="e.g. Endurance Events Australia" /></div>
              <div><FieldLabel label="About" hint={`${profile.bio.length}/600`} /><FTextarea rows={4} maxLength={600} value={profile.bio} onChange={e => onChange({ bio: e.target.value })} placeholder="Tell athletes what you run and who you are…" /></div>
            </div>
          </div>

          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-lime-400" /> Contact
            </div>
            <div className="space-y-4">
              <div><FieldLabel label="Contact name" required /><FInput value={profile.contactName} onChange={e => onChange({ contactName: e.target.value })} placeholder="Full name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label="State" required />
                  <select value={state} onChange={e => onStateChange(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-gray-900 focus:border-lime-500 focus:outline-none transition-colors appearance-none">
                    {STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><FieldLabel label="ABN" /><FInput value={profile.abn} onChange={e => onChange({ abn: e.target.value })} placeholder="12 345 678 901" /></div>
              </div>
              <div>
                <FieldLabel label="Contact email" required />
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><FInput className="pl-9" type="email" value={profile.contactEmail} onChange={e => onChange({ contactEmail: e.target.value })} placeholder="events@yourorg.com.au" /></div>
              </div>
              <div>
                <FieldLabel label="Phone" />
                <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><FInput className="pl-9" type="tel" value={profile.phone} onChange={e => onChange({ phone: e.target.value })} placeholder="+61 4xx xxx xxx" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label="Website" />
                  <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><FInput className="pl-9" value={profile.website} onChange={e => onChange({ website: e.target.value })} placeholder="https://â€¦" /></div>
                </div>
                <div>
                  <FieldLabel label="Instagram" />
                  <div className="relative"><Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><FInput className="pl-9" value={profile.instagram} onChange={e => onChange({ instagram: e.target.value })} placeholder="@handle" /></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-lime-400" /> Security
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200">
              <div>
                <div className="font-headline text-[13px] font-bold text-gray-900 mb-0.5">Password</div>
                <div className="text-[11px] text-gray-400">Update your login credentials.</div>
              </div>
              <Button variant="outline" size="sm">Change</Button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="font-headline text-[11px] uppercase tracking-widest">
            {saved  && <span className="text-lime-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Saved</span>}
            {error  && <span className="text-red-500">{error}</span>}
            {!saved && !error && <span className="text-gray-400">Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              <CheckCircle className="w-4 h-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function RatingBadge({ avg, count }: { avg: number; count: number }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
      <span className="font-headline text-[13px] font-black text-gray-900">{avg.toFixed(1)}</span>
      <span className="font-headline text-[11px] text-gray-400">({count} review{count !== 1 ? "s" : ""})</span>
    </div>
  );
}

type Tab = "upcoming" | "past" | "drafts";

export default function ProfilePage() {
  const [profile,        setProfile]        = useState<Profile>(EMPTY);
  const [state,          setState]          = useState("nsw");
  const [events,         setEvents]         = useState<EventRow[]>([]);
  const [reviews,        setReviews]        = useState<Review[]>([]);
  const [pinnedIds,      setPinnedIds]      = useState<string[]>([]);
  const [organiserId,    setOrganiserId]    = useState<string>("");
  const [loading,        setLoading]        = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [tab,            setTab]            = useState<Tab>("upcoming");
  const [editOpen,       setEditOpen]       = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState("");
  const [logoUploading,  setLogoUploading]  = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/organiser/profile").then(r => r.json()),
      fetch("/api/organiser/events").then(r => r.json()),
    ]).then(([prof, evts]) => {
      if (prof && !prof.error) {
        setOrganiserId(prof.id ?? "");
        setProfile({
          orgName:      prof.orgName      ?? "",
          contactName:  prof.contactName  ?? "",
          phone:        prof.phone        ?? "",
          contactEmail: prof.contactEmail ?? "",
          website:      prof.website      ?? "",
          instagram:    prof.instagram    ?? "",
          facebook:     prof.facebook     ?? "",
          bio:          prof.bio          ?? "",
          abn:          prof.abn          ?? "",
          logoUrl:      prof.logoUrl      ?? "",
        });
      }
      if (Array.isArray(evts)) {
        setEvents(evts);
        setPinnedIds(evts.filter((e: EventRow) => e.isPinned).map((e: EventRow) => e.id));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/organiser/reviews")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setReviews(data); })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, []);

  const tabs = useMemo(() => ({
    upcoming: events.filter(e => (e.status === "APPROVED" || e.status === "PENDING") && isUpcoming(e.eventDate)),
    past:     events.filter(e => e.status === "APPROVED" && !isUpcoming(e.eventDate)),
    drafts:   events.filter(e => e.status === "DRAFT"),
  }), [events]);

  const displayed = tabs[tab];

  const carouselEvents: CarouselEvent[] = useMemo(
    () => events.filter(e => e.status === "APPROVED" || e.status === "PENDING"),
    [events],
  );

  const photos = useMemo(
    () => events.map(e => e.coverImageUrl).filter((u): u is string => !!u),
    [events],
  );

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length
    : 0;

  const togglePin = useCallback(async (id: string) => {
    const nowPinned = !pinnedIds.includes(id);
    setPinnedIds(prev => nowPinned ? [...prev, id] : prev.filter(x => x !== id));
    try {
      await fetch(`/api/organiser/events/${id}/pin`, { method: "PATCH" });
    } catch {
      setPinnedIds(prev => nowPinned ? prev.filter(x => x !== id) : [...prev, id]);
    }
  }, [pinnedIds]);

  const handleNewReview = useCallback((r: Review) => {
    setReviews(prev => [r, ...prev]);
  }, []);

  const u = (patch: Partial<Profile>) => setProfile(p => ({ ...p, ...patch }));

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res  = await fetch("/api/organiser/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed."); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("Something went wrong. Please try again."); }
    finally   { setSaving(false); }
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "logo");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("Upload failed.");
      const { fileUrl } = await uploadRes.json();
      await fetch("/api/organiser/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, logoUrl: fileUrl }),
      });
      setProfile(p => ({ ...p, logoUrl: fileUrl }));
    } catch {
      setError("Logo upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  };

  const initial = (profile.orgName || "O").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-16 page-in pb-24 lg:pb-0">

        {/* Banner */}
        <section className="relative h-36 sm:h-44 border-b border-gray-200 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)" }} />
          <button className="absolute top-3 right-3 flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors">
            <Camera className="w-3.5 h-3.5" /> Change banner
          </button>
        </section>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10">

          {/* Profile header — centered on mobile, left-aligned on sm+ */}
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left sm:justify-between gap-4 -mt-10 mb-6 relative z-10">
            <div className="flex flex-col items-center sm:flex-row sm:items-end gap-3 sm:gap-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-xl bg-lime-400 text-gray-900 font-headline font-black italic text-4xl flex items-center justify-center border-4 border-white shadow-md overflow-hidden">
                  {profile.logoUrl
                    ? <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    : initial}
                </div>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-gray-200 hover:border-gray-400 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-50">
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                {logoUploading && (
                  <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="pb-1">
                <h1 className="font-headline text-2xl lg:text-3xl font-black italic tracking-tighter text-gray-900 leading-tight">
                  {loading ? "Loading…" : (profile.orgName || "Your Organisation")}
                </h1>
                <div className="flex items-center justify-center sm:justify-start gap-3 mt-1.5 flex-wrap">
                  <Badge variant="live" className="gap-1">
                    <CheckCircle className="w-3 h-3" /> Verified Organiser
                  </Badge>
                  {reviews.length > 0 && <RatingBadge avg={avgRating} count={reviews.length} />}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer"
                      className="font-headline text-[11px] uppercase tracking-widest text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                      <Globe className="w-3 h-3" /> {profile.website.replace(/https?:\/\//, "")}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-1 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" onClick={() => setEditOpen(true)}>
                <Edit2 className="w-4 h-4" /> Edit Profile
              </Button>
              <Button asChild size="sm" className="flex-1 sm:flex-initial">
                <Link href="/organiser/new-listing">
                  <Plus className="w-4 h-4" /> Post a new event
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center justify-center sm:justify-start gap-6 mb-8 pb-6 border-b border-gray-200 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-lime-500" />
              <span className="font-headline text-[13px] font-bold text-gray-900">{events.filter(e => e.status === "APPROVED").length}</span>
              <span className="font-headline text-[11px] uppercase tracking-widest text-gray-400">events hosted</span>
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-headline text-[13px] font-bold text-gray-900">{avgRating.toFixed(1)}</span>
                <span className="font-headline text-[11px] uppercase tracking-widest text-gray-400">avg rating</span>
              </div>
            )}
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 font-headline text-[11px] uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors">
                <Instagram className="w-4 h-4" /> {profile.instagram}
              </a>
            )}
          </div>

          {/* Bio — visible on mobile only, above events */}
          {profile.bio && (
            <div className="lg:hidden mb-8">
              <p className="text-[14px] text-gray-600 leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Main 2-col layout */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-8 pb-16">
            <div className="space-y-10">

              {carouselEvents.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900">Featured Events</h2>
                      <p className="text-[12px] text-gray-400 mt-0.5">
                        {pinnedIds.length > 0
                          ? `${pinnedIds.length} pinned Â· athletes see these first`
                          : "Pin events to feature them at the top of your profile."}
                      </p>
                    </div>
                  </div>
                  <EventCarousel events={carouselEvents} pinnedIds={pinnedIds} isOrganiser onPin={togglePin} />
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-headline text-2xl font-black italic tracking-tighter text-gray-900">My Events</h2>
                    <p className="text-[13px] text-gray-400 mt-0.5">All the events you&apos;ve posted on Startline.</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-0 border-b border-gray-200 mb-6">
                  {([
                    { k: "upcoming", l: "Upcoming" },
                    { k: "past",     l: "Past"     },
                    { k: "drafts",   l: "Drafts"   },
                  ] as { k: Tab; l: string }[]).map(t => (
                    <button key={t.k} onClick={() => setTab(t.k)}
                      className={`relative pb-3 px-4 font-headline text-[12px] font-bold uppercase tracking-widest transition-colors
                        ${tab === t.k
                          ? "text-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-lime-500 after:rounded-t"
                          : "text-gray-400 hover:text-gray-700"}`}>
                      {t.l}
                      <span className={`ml-1.5 font-headline text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.k ? "bg-lime-50 text-lime-700" : "bg-gray-100 text-gray-400"}`}>
                        {tabs[t.k].length}
                      </span>
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div className="py-12 text-center">
                    <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
                    <div className="font-headline text-sm text-gray-400 uppercase tracking-widest">Loadingâ€¦</div>
                  </div>
                ) : displayed.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger-item">
                    {displayed.map(e => <EventCard key={e.id} e={e} />)}
                  </div>
                ) : (
                  <div className="py-16 text-center border border-dashed border-gray-200 rounded-xl bg-white">
                    <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <div className="font-headline text-[15px] font-black italic text-gray-900 mb-1">
                      {tab === "upcoming" ? "No upcoming events" : tab === "past" ? "No past events" : "No drafts"}
                    </div>
                    <div className="text-[13px] text-gray-400 mb-5">
                      {tab === "drafts" ? "Start drafting a new event listing." : tab === "upcoming" ? "Post a new event to get started." : "Completed events will appear here."}
                    </div>
                    {(tab === "upcoming" || tab === "drafts") && (
                      <Button asChild size="sm">
                        <Link href="/organiser/new-listing">
                          <Plus className="w-4 h-4" /> Create listing
                        </Link>
                      </Button>
                    )}
                  </div>
                )}

                {displayed.length > 0 && (
                  <Link href="/organiser/new-listing"
                    className="group w-full mt-4 border border-dashed border-gray-200 hover:border-lime-400 bg-white rounded-xl p-4 flex items-center justify-center gap-3 text-gray-400 hover:text-lime-600 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:shadow-none transition-[transform,box-shadow] duration-200 ease-out">
                    <Plus className="w-4 h-4" />
                    <span className="font-headline text-[11px] font-bold uppercase tracking-widest">Add another listing</span>
                  </Link>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-lime-500" /> Photos
                    </h2>
                    <p className="text-[12px] text-gray-400 mt-0.5">Event highlights and action shots.</p>
                  </div>
                  {photos.length > 0 && (
                    <Button variant="outline" size="sm">Upload</Button>
                  )}
                </div>
                <PhotoCarousel photos={photos} isOrganiser />
              </section>

              <section>
                <ReviewsSection reviews={reviews} organiserId={organiserId} loading={reviewsLoading} onNewReview={handleNewReview} />
              </section>
            </div>

            {/* Right sidebar */}
            <aside className="space-y-4 lg:sticky lg:top-24 h-fit">

              {profile.bio && (
                <Card className="hidden lg:block">
                  <CardContent className="p-5">
                    <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">About</div>
                    <p className="text-[13px] text-gray-700 leading-relaxed">{profile.bio}</p>
                  </CardContent>
                </Card>
              )}

              {reviews.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Rating</div>
                    <div className="flex items-center gap-3">
                      <div className="font-headline text-[36px] font-black italic leading-none text-gray-900">{avgRating.toFixed(1)}</div>
                      <div>
                        <div className="flex gap-0.5 mb-0.5">
                          {[1,2,3,4,5].map(i => (
                            <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(avgRating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { const el = document.getElementById("reviews"); el?.scrollIntoView({ behavior: "smooth" }); }}
                      className="mt-3 w-full text-left font-headline text-[11px] font-bold uppercase tracking-widest text-lime-600 hover:underline"
                    >
                      See all reviews →
                    </button>
                  </CardContent>
                </Card>
              )}

              <Card className="hidden lg:block">
                <CardContent className="p-4">
                  <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Quick links</div>
                  <div className="space-y-1">
                    <button onClick={() => setEditOpen(true)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 group transition-colors">
                      <span className="font-headline text-[13px] font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Edit profile</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </button>
                    <Link href="/organiser/listings"
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 group transition-colors">
                      <span className="font-headline text-[13px] font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Manage all events</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </Link>
                    <Link href="/organiser/new-listing"
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 group transition-colors">
                      <span className="font-headline text-[13px] font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Post a new event</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </Link>
                  </div>
                </CardContent>
              </Card>

            </aside>
          </div>
        </div>
      </main>

      {editOpen && (
        <EditPanel
          profile={profile} state={state}
          saving={saving} saved={saved} error={error}
          onChange={u} onStateChange={setState}
          onSave={handleSave}
          onClose={() => { setEditOpen(false); setError(""); }}
        />
      )}
    </div>
  );
}

