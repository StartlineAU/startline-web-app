"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus, MapPin, ArrowRight, CheckCircle, Globe, Instagram,
  Phone, Mail, X, Edit2, Camera, CalendarDays,
} from "lucide-react";

import OrganiserTopBar from "@/components/organiser/TopBar";
import PhotoCarousel from "@/components/organiser/PhotoCarousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; startTime: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null; isPinned?: boolean; registrationCount?: number | null;
}

interface Profile {
  orgName: string; contactName: string; phone: string; contactEmail: string;
  website: string; instagram: string; facebook: string; bio: string; abn: string;
  logoUrl: string;
}

interface ReviewData {
  id: string; reviewerName: string; eventTitle?: string | null;
  overallRating: number; title: string; body: string; isVerified: boolean; createdAt: string;
}

const EMPTY: Profile = {
  orgName: "", contactName: "", phone: "", contactEmail: "",
  website: "", instagram: "", facebook: "", bio: "", abn: "", logoUrl: "",
};

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string; pulse?: boolean }> = {
  APPROVED: { bg: "bg-lime-50",   text: "text-lime-700",  dot: "bg-lime-500",  label: "Live",     pulse: true },
  PENDING:  { bg: "bg-blue-50",   text: "text-blue-600",  dot: "bg-blue-500",  label: "Pending"  },
  DRAFT:    { bg: "bg-gray-100",  text: "text-gray-500",  dot: "bg-gray-400",  label: "Draft"    },
  REJECTED: { bg: "bg-red-50",    text: "text-red-600",   dot: "bg-red-500",   label: "Rejected" },
  ARCHIVED: { bg: "bg-gray-100",  text: "text-gray-400",  dot: "bg-gray-300",  label: "Archived" },
};

function formatEventDate(dateStr: string, startTime: string) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const time = startTime
      ? new Date(`1970-01-01T${startTime}`).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()
      : null;
    return time ? `${day} · ${time}` : day;
  } catch { return dateStr; }
}

// Edit Profile slide-over ──────────────────────────────────────────────────────

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
                  <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><FInput className="pl-9" value={profile.website} onChange={e => onChange({ website: e.target.value })} placeholder="https://…" /></div>
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

export default function ProfilePage() {
  const [profile,       setProfile]       = useState<Profile>(EMPTY);
  const [state,         setState]         = useState("nsw");
  const [events,        setEvents]        = useState<EventRow[]>([]);
  const [pinnedIds,     setPinnedIds]     = useState<string[]>([]);
  const [avgRating,     setAvgRating]     = useState<number | null>(null);
  const [reviewCount,   setReviewCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [editOpen,      setEditOpen]      = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [reviews,       setReviews]       = useState<ReviewData[]>([]);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/organiser/profile").then(r => r.json()),
      fetch("/api/organiser/events").then(r => r.json()),
    ]).then(([prof, evts]) => {
      if (prof && !prof.error) {
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
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setReviews(data);
          setReviewCount(data.length);
          setAvgRating(data.reduce((s: number, r: { overallRating: number }) => s + r.overallRating, 0) / data.length);
        }
      })
      .catch(() => {});
  }, []);

  const photos = useMemo(
    () => events.map(e => e.coverImageUrl).filter((u): u is string => !!u),
    [events],
  );

  const togglePin = useCallback(async (id: string) => {
    const nowPinned = !pinnedIds.includes(id);
    setPinnedIds(prev => nowPinned ? [...prev, id] : prev.filter(x => x !== id));
    try {
      await fetch(`/api/organiser/events/${id}/pin`, { method: "PATCH" });
    } catch {
      setPinnedIds(prev => nowPinned ? prev.filter(x => x !== id) : [...prev, id]);
    }
  }, [pinnedIds]);

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
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10">

          {/* Banner — contained */}
          <div className="relative h-36 sm:h-44 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 mt-6">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)" }} />
          </div>

          {/* Avatar + Name row — avatar overlaps bottom of banner, name sits beside it */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 mb-6 relative z-10">
            <div className="flex items-end gap-4">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-xl bg-lime-400 text-gray-900 font-headline font-black italic text-4xl flex items-center justify-center border-4 border-white shadow-md overflow-hidden">
                  {profile.logoUrl
                    ? <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    : initial}
                </div>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-gray-200 hover:border-gray-400 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50">
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
                <h1 className="font-headline text-4xl lg:text-5xl font-black italic tracking-tighter text-gray-900 leading-none">
                  {loading ? "Loading…" : (profile.orgName || "Your Organisation")}
                </h1>
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 font-headline text-[11px] uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors">
                    <Globe className="w-3 h-3" /> {profile.website.replace(/https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </Button>
                <Button asChild size="sm">
                  <Link href="/organiser/new-listing">
                    <Plus className="w-4 h-4" /> Post a new event
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* About + Metrics row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8 pb-6 border-b border-gray-200">
            <div className="flex-1">
              {profile.bio
                ? <p className="text-[14px] text-gray-700 leading-relaxed">{profile.bio}</p>
                : <p className="text-[14px] text-gray-400 italic">No bio yet — add one in Edit Profile.</p>}
              {profile.instagram && (
                <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 font-headline text-[11px] uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors">
                  <Instagram className="w-3.5 h-3.5" /> {profile.instagram}
                </a>
              )}
            </div>
            <div className="flex flex-row gap-8 shrink-0 items-start">
              <div>
                <div className="font-headline text-xl font-black italic tracking-tighter text-gray-900">
                  {loading ? "—" : events.filter(e => e.status === "APPROVED").length}
                </div>
                <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-gray-400">Events hosted</div>
              </div>
              <div>
                <div className="font-headline text-xl font-black italic tracking-tighter text-gray-900">
                  {avgRating !== null ? avgRating.toFixed(1) : "—"}
                </div>
                <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg rating</div>
              </div>
              <div>
                <div className="font-headline text-xl font-black italic tracking-tighter text-gray-900">0</div>
                <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-gray-400">Followers</div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="pb-16 space-y-10">

            {/* Events */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900">Events</h2>
                {events.filter(e => e.status !== "ARCHIVED").length > 3 && (
                  <button
                    onClick={() => setShowAllEvents(v => !v)}
                    className="font-headline text-[11px] uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1">
                    {showAllEvents ? "Show less" : "View all"}
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform duration-300 ${showAllEvents ? "-rotate-90" : "rotate-90"}`} />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="py-10 text-center">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
                </div>
              ) : events.filter(e => e.status !== "ARCHIVED").length === 0 ? (
                <div className="py-14 text-center border border-dashed border-gray-200 rounded-xl bg-white">
                  <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <div className="font-headline text-[15px] font-black italic text-gray-900 mb-1">No events yet</div>
                  <div className="text-[13px] text-gray-400 mb-5">Post your first event to get started.</div>
                  <Button asChild size="sm">
                    <Link href="/organiser/new-listing"><Plus className="w-4 h-4" /> Add new event</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const visible = events.filter(e => e.status !== "ARCHIVED");
                      const shown = showAllEvents ? visible : visible.slice(0, 3);
                      return shown.map(e => {
                        const s     = STATUS_STYLE[e.status];
                        const price = (e.waves as { price: string }[])?.[0]?.price;
                        return (
                          <Link key={e.id} href={`/organiser/new-listing?id=${e.id}`}
                            className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-200">
                            {/* Image */}
                            <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                              {e.coverImageUrl
                                ? <img src={e.coverImageUrl} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                : <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                    <span className="font-headline font-black italic text-gray-300 text-4xl tracking-tighter">{e.discipline.slice(0, 4).toUpperCase()}</span>
                                  </div>}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                              {/* Discipline badge */}
                              <span className="absolute top-3 left-3 font-headline text-[10px] font-bold uppercase tracking-widest bg-lime-400 text-gray-900 px-2 py-1 rounded">
                                {e.discipline}
                              </span>
                              {/* Status badge */}
                              <span className={`absolute top-3 right-3 font-headline text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded flex items-center gap-1 ${s.bg} ${s.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse-dot" : ""}`} />
                                {s.label}
                              </span>
                              {/* Date overlay */}
                              <div className="absolute bottom-3 right-3 text-right">
                                <div className="font-headline text-[10px] uppercase tracking-widest text-white/70">
                                  {new Date(e.eventDate + "T00:00:00").toLocaleDateString("en-AU", { month: "short" }).toUpperCase()}
                                </div>
                                <div className="font-headline text-2xl font-black italic leading-none text-white">
                                  {new Date(e.eventDate + "T00:00:00").getDate()}
                                </div>
                              </div>
                            </div>
                            {/* Body */}
                            <div className="p-4">
                              <div className="font-headline text-[16px] font-black italic tracking-tighter text-gray-900 leading-tight mb-1 line-clamp-1 group-hover:text-lime-600 transition-colors">
                                {e.title}
                              </div>
                              <div className="flex items-center gap-1 font-headline text-[11px] text-gray-400 uppercase tracking-widest mb-3">
                                <MapPin className="w-3 h-3 text-lime-500 shrink-0" /> {e.city}, {e.state.toUpperCase()}
                              </div>
                              {price && (
                                <div className="pt-3 border-t border-gray-100">
                                  <div className="font-headline text-[11px] font-bold text-lime-600">from A${price}</div>
                                </div>
                              )}
                            </div>
                          </Link>
                        );
                      });
                    })()}
                  </div>
                </>
              )}
            </section>

            {/* Photos */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900">Photos</h2>
              </div>
              <PhotoCarousel photos={photos} isOrganiser />
            </section>

            {/* Reviews */}
            <section>
              <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900 mb-4">Reviews</h2>
              {reviews.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-gray-200 rounded-xl bg-white">
                  <div className="font-headline text-[15px] font-black italic text-gray-900 mb-1">No reviews yet</div>
                  <div className="text-[13px] text-gray-400">Reviews from athletes will appear here.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map(r => (
                    <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <div className="font-headline text-[14px] font-bold text-gray-900">{r.title}</div>
                          <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400 mt-0.5">
                            {r.reviewerName}{r.eventTitle ? ` · ${r.eventTitle}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1,2,3,4,5].map(i => (
                            <svg key={i} className={`w-3.5 h-3.5 ${i <= r.overallRating ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <p className="text-[13px] text-gray-700 leading-relaxed">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

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
