"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus, MapPin, ArrowRight, CheckCircle, Globe, Instagram,
  Phone, Mail, X, Edit2, Camera, CalendarDays, ChevronRight,
  Star, ImageIcon,
} from "lucide-react";
import OrganiserSidebar from "@/components/organiser/Sidebar";
import OrganiserTopBar  from "@/components/organiser/TopBar";
import EventCarousel, { type CarouselEvent } from "@/components/organiser/EventCarousel";
import ReviewsSection,  { type Review }        from "@/components/organiser/ReviewsSection";
import PhotoCarousel from "@/components/organiser/PhotoCarousel";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null; isPinned?: boolean;
}

interface Profile {
  orgName: string; contactName: string; phone: string; email: string;
  website: string; instagram: string; facebook: string; bio: string; abn: string;
  logoUrl: string;
}

const EMPTY: Profile = {
  orgName: "", contactName: "", phone: "", email: "",
  website: "", instagram: "", facebook: "", bio: "", abn: "", logoUrl: "",
};

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string }> = {
  APPROVED: { bg: "bg-primary/20",   text: "text-primary",    dot: "bg-primary",    label: "LIVE"     },
  PENDING:  { bg: "bg-blue-900/30",  text: "text-blue-400",   dot: "bg-blue-400",   label: "PENDING"  },
  DRAFT:    { bg: "bg-dark-lighter", text: "text-muted",      dot: "bg-muted",      label: "DRAFT"    },
  REJECTED: { bg: "bg-red-900/30",   text: "text-red-400",    dot: "bg-red-400",    label: "REJECTED" },
  ARCHIVED: { bg: "bg-dark-lighter", text: "text-muted-dark", dot: "bg-muted-dark", label: "ARCHIVED" },
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

// ─── Small event card (used in tab grid) ─────────────────────────────────────

function EventCard({ e }: { e: EventRow }) {
  const s    = STATUS_STYLE[e.status];
  const date = formatEventDate(e.eventDate);
  const cap  = e.cap ?? 0;

  return (
    <div className="bg-dark border border-dark-lighter rounded-lg overflow-hidden flex flex-col card-hover hover:border-primary/40">
      <div className="relative h-24 overflow-hidden">
        {e.coverImageUrl ? (
          <img src={e.coverImageUrl} alt={e.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 hero-topo scan-grid" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark/60 to-transparent" />
        <div className="absolute top-2 left-2">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-headline text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${e.status === "APPROVED" ? "animate-pulse-dot" : ""}`} />
            {s.label}
          </span>
        </div>
        {date.day !== "—" && (
          <div className="absolute bottom-2 right-2 text-right">
            <div className="font-headline text-[9px] uppercase tracking-widest text-light/60">{date.month}</div>
            <div className="font-headline text-2xl font-black italic leading-none text-light">{date.day}</div>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-1">{e.discipline}</div>
        <div className="font-headline text-[16px] font-black italic tracking-tighter text-light leading-tight mb-1.5 line-clamp-2">{e.title}</div>
        <div className="flex items-center gap-1 font-headline text-[11px] text-muted uppercase tracking-widest mb-4">
          <MapPin className="w-3 h-3 text-primary shrink-0" /> {e.city}, {e.state.toUpperCase()}
        </div>

        {cap > 0 ? (
          <div className="mt-auto mb-4">
            <div className="flex items-center justify-between font-headline text-[11px] uppercase tracking-widest mb-1.5">
              <span className="text-light font-bold">0 signed up</span>
              <span className="text-muted-dark">of {cap}</span>
            </div>
            <div className="h-1 bg-dark-lighter rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: "0%" }} />
            </div>
          </div>
        ) : (
          <div className="mt-auto mb-4" />
        )}

        <div className="pt-3 border-t border-dark-lighter">
          <button className="w-full flex items-center justify-between font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors group">
            View event <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Profile slide-over ──────────────────────────────────────────────────

const STATES = [
  ["nsw","NSW"],["vic","VIC"],["qld","QLD"],["wa","WA"],
  ["sa","SA"],["tas","TAS"],["act","ACT"],["nt","NT"],
] as const;

const DISCIPLINES = ["functional_fitness", "crossfit", "running", "hybrid"] as const;

function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>}
    </div>
  );
}

const FInput = ({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`w-full bg-dark-darker border border-dark-lighter rounded-md px-3 py-2.5 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors ${className}`} />
);

const FTextarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className="w-full bg-dark-darker border border-dark-lighter rounded-md px-3 py-2.5 text-[13px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors resize-none" />
);

interface EditPanelProps {
  profile: Profile; state: string; disciplines: string[];
  saving: boolean; saved: boolean; error: string;
  onChange: (patch: Partial<Profile>) => void;
  onStateChange: (s: string) => void;
  onToggleDisc: (d: string) => void;
  onSave: () => void; onClose: () => void;
}

function EditPanel({ profile, state, disciplines, saving, saved, error, onChange, onStateChange, onToggleDisc, onSave, onClose }: EditPanelProps) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-dark-darker/70 backdrop-blur-sm overlay-in" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] bg-dark border-l border-dark-lighter flex flex-col modal-in overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-dark border-b border-dark-lighter">
          <div>
            <h2 className="font-headline text-xl font-black italic tracking-tighter text-light">Edit Profile</h2>
            <p className="text-[12px] text-muted mt-0.5">Changes are reflected on your public listing page.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-dark-lighter text-muted hover:text-primary flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-primary" /> Organisation
            </div>
            <div className="space-y-4">
              <div><FieldLabel label="Organisation name" required /><FInput value={profile.orgName} onChange={e => onChange({ orgName: e.target.value })} placeholder="e.g. Endurance Events Australia" /></div>
              <div><FieldLabel label="About" hint={`${profile.bio.length}/600`} /><FTextarea rows={4} maxLength={600} value={profile.bio} onChange={e => onChange({ bio: e.target.value })} placeholder="Tell athletes what you run and who you are…" /></div>
              <div>
                <FieldLabel label="Event disciplines" hint="Pick all that apply" />
                <div className="flex flex-wrap gap-2">
                  {DISCIPLINES.map(d => (
                    <button key={d} type="button" onClick={() => onToggleDisc(d)}
                      className={`font-headline text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md chip flex items-center gap-1.5 ${disciplines.includes(d) ? "chip-active" : ""}`}>
                      {disciplines.includes(d) && <CheckCircle className="w-3 h-3" />}{d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-primary" /> Contact
            </div>
            <div className="space-y-4">
              <div><FieldLabel label="Contact name" required /><FInput value={profile.contactName} onChange={e => onChange({ contactName: e.target.value })} placeholder="Full name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label="State" required />
                  <select value={state} onChange={e => onStateChange(e.target.value)}
                    className="w-full bg-dark-darker border border-dark-lighter rounded-md px-3 py-2.5 text-[14px] text-light focus:border-primary focus:outline-none transition-colors appearance-none">
                    {STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><FieldLabel label="ABN" /><FInput value={profile.abn} onChange={e => onChange({ abn: e.target.value })} placeholder="12 345 678 901" /></div>
              </div>
              <div>
                <FieldLabel label="Contact email" required />
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" /><FInput className="pl-9" type="email" value={profile.email} onChange={e => onChange({ email: e.target.value })} placeholder="events@yourorg.com.au" /></div>
              </div>
              <div>
                <FieldLabel label="Phone" />
                <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" /><FInput className="pl-9" type="tel" value={profile.phone} onChange={e => onChange({ phone: e.target.value })} placeholder="+61 4xx xxx xxx" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label="Website" />
                  <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" /><FInput className="pl-9" value={profile.website} onChange={e => onChange({ website: e.target.value })} placeholder="https://…" /></div>
                </div>
                <div>
                  <FieldLabel label="Instagram" />
                  <div className="relative"><Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" /><FInput className="pl-9" value={profile.instagram} onChange={e => onChange({ instagram: e.target.value })} placeholder="@handle" /></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-primary" /> Security
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-4 rounded-md border border-dark-lighter">
                <div>
                  <div className="font-headline text-[13px] font-bold text-light mb-0.5">Password</div>
                  <div className="text-[11px] text-muted">Update your login credentials.</div>
                </div>
                <button className="font-headline text-[11px] font-bold uppercase tracking-widest text-light border border-dark-lighter hover:border-primary/60 px-3 py-2 rounded-md transition-colors">Change</button>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-dark-lighter bg-dark px-6 py-4 flex items-center justify-between gap-4">
          <div className="font-headline text-[11px] uppercase tracking-widest">
            {saved  && <span className="text-primary flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Saved</span>}
            {error  && <span className="text-red-400">{error}</span>}
            {!saved && !error && <span className="text-muted">Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light px-4 py-2.5 transition-colors">Cancel</button>
            <button onClick={onSave} disabled={saving}
              className="bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50">
              <CheckCircle className="w-4 h-4" /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Compact rating badge (sidebar) ──────────────────────────────────────────

function RatingBadge({ avg, count }: { avg: number; count: number }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
      <span className="font-headline text-[13px] font-black text-light">{avg.toFixed(1)}</span>
      <span className="font-headline text-[11px] text-muted">({count} review{count !== 1 ? "s" : ""})</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "upcoming" | "past" | "drafts";

export default function ProfilePage() {
  const [profile,        setProfile]        = useState<Profile>(EMPTY);
  const [state,          setState]          = useState("nsw");
  const [disciplines,    setDisciplines]    = useState<string[]>([]);
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
          orgName:     prof.orgName     ?? "",
          contactName: prof.contactName ?? "",
          phone:       prof.phone       ?? "",
          email:       prof.email       ?? "",
          website:     prof.website     ?? "",
          instagram:   prof.instagram   ?? "",
          facebook:    prof.facebook    ?? "",
          bio:         prof.bio         ?? "",
          abn:         prof.abn         ?? "",
          logoUrl:     prof.logoUrl     ?? "",
        });
      }
      if (Array.isArray(evts)) {
        setEvents(evts);
        // Seed pinned ids from DB data
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

  // Events eligible for the top carousel (live or pending)
  const carouselEvents: CarouselEvent[] = useMemo(
    () => events.filter(e => e.status === "APPROVED" || e.status === "PENDING"),
    [events],
  );

  // Photos from event cover images
  const photos = useMemo(
    () => events.map(e => e.coverImageUrl).filter((u): u is string => !!u),
    [events],
  );

  // Rating aggregates
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length
    : 0;

  const togglePin = useCallback(async (id: string) => {
    const nowPinned = !pinnedIds.includes(id);
    // Optimistic update
    setPinnedIds(prev => nowPinned ? [...prev, id] : prev.filter(x => x !== id));

    try {
      await fetch(`/api/organiser/events/${id}/pin`, { method: "PATCH" });
    } catch {
      // If API fails, revert
      setPinnedIds(prev => nowPinned ? prev.filter(x => x !== id) : [...prev, id]);
    }
  }, [pinnedIds]);

  const handleNewReview = useCallback((r: Review) => {
    setReviews(prev => [r, ...prev]);
  }, []);

  const u       = (patch: Partial<Profile>) => setProfile(p => ({ ...p, ...patch }));
  const toggleD = (d: string) => setDisciplines(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

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
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "logo", contentType: file.type, filename: file.name }),
      });
      if (!presignRes.ok) throw new Error("Failed to get upload URL.");
      const { uploadUrl, fileUrl } = await presignRes.json();

      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

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
    <div className="min-h-screen bg-dark-darker">
      <OrganiserTopBar />
      <div className="flex pt-16">
        <OrganiserSidebar />

        <main className="flex-1 min-w-0 page-in pb-24 lg:pb-0">

          {/* ── Banner ── */}
          <section className="relative h-44 border-b border-dark-lighter overflow-hidden">
            <div className="absolute inset-0 hero-topo" />
            <div className="absolute inset-0 scan-grid opacity-40" />
            <button className="absolute top-4 right-4 flex items-center gap-2 bg-dark/70 backdrop-blur-sm border border-dark-lighter hover:border-primary/60 rounded-md px-3 py-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors">
              <Camera className="w-3.5 h-3.5" /> Change banner
            </button>
          </section>

          <div className="max-w-[1200px] mx-auto px-6 lg:px-10">

            {/* ── Profile header ── */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 mb-6 relative z-10">
              <div className="flex items-end gap-4">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-xl bg-primary text-dark font-headline font-black italic text-4xl flex items-center justify-center border-4 border-dark-darker shadow-machined overflow-hidden">
                    {profile.logoUrl
                      ? <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      : initial}
                  </div>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-dark border border-dark-lighter hover:border-primary text-muted hover:text-primary flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50">
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                  />
                  {logoUploading && (
                    <div className="absolute inset-0 rounded-xl bg-dark/70 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="pb-1">
                  <h1 className="font-headline text-2xl lg:text-3xl font-black italic tracking-tighter text-light leading-tight">
                    {loading ? "Loading…" : (profile.orgName || "Your Organisation")}
                  </h1>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/15 text-primary font-headline text-[10px] font-bold uppercase tracking-widest rounded-full">
                      <CheckCircle className="w-3 h-3" /> Verified Organiser
                    </span>
                    {reviews.length > 0 && (
                      <RatingBadge avg={avgRating} count={reviews.length} />
                    )}
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noreferrer"
                        className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary flex items-center gap-1 transition-colors">
                        <Globe className="w-3 h-3" /> {profile.website.replace(/https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pb-1">
                <button onClick={() => setEditOpen(true)}
                  className="flex items-center gap-2 border border-dark-lighter hover:border-primary/60 text-muted hover:text-light font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md transition-colors">
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
                <Link href="/organiser/new-listing"
                  className="bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform">
                  <Plus className="w-4 h-4" /> Post a new event
                </Link>
              </div>
            </div>

            {/* ── Stats bar ── */}
            <div className="flex items-center gap-6 mb-8 pb-6 border-b border-dark-lighter flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span className="font-headline text-[13px] font-bold text-light">{events.filter(e => e.status === "APPROVED").length}</span>
                <span className="font-headline text-[11px] uppercase tracking-widest text-muted">events hosted</span>
              </div>
              {reviews.length > 0 && (
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-headline text-[13px] font-bold text-light">{avgRating.toFixed(1)}</span>
                  <span className="font-headline text-[11px] uppercase tracking-widest text-muted">avg rating</span>
                </div>
              )}
              {profile.instagram && (
                <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
                  <Instagram className="w-4 h-4" /> {profile.instagram}
                </a>
              )}
            </div>

            {/* ── Main 2-col layout ── */}
            <div className="grid lg:grid-cols-[1fr_300px] gap-8 pb-16">
              <div className="space-y-10">

                {/* ── SECTION 1: Featured Events Carousel ── */}
                {carouselEvents.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="font-headline text-xl font-black italic tracking-tighter text-light">Featured Events</h2>
                        <p className="text-[12px] text-muted mt-0.5">
                          {pinnedIds.length > 0
                            ? `${pinnedIds.length} pinned · athletes see these first`
                            : "Pin events to feature them at the top of your profile."}
                        </p>
                      </div>
                    </div>
                    <EventCarousel
                      events={carouselEvents}
                      pinnedIds={pinnedIds}
                      isOrganiser
                      onPin={togglePin}
                    />
                  </section>
                )}

                {/* ── SECTION 2: My Events tabs ── */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-headline text-2xl font-black italic tracking-tighter text-light">My Events</h2>
                      <p className="text-[13px] text-muted mt-0.5">All the events you&apos;ve posted on Startline.</p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-0 border-b border-dark-lighter mb-6">
                    {([
                      { k: "upcoming", l: "Upcoming" },
                      { k: "past",     l: "Past"     },
                      { k: "drafts",   l: "Drafts"   },
                    ] as { k: Tab; l: string }[]).map(t => (
                      <button key={t.k} onClick={() => setTab(t.k)}
                        className={`relative pb-3 px-4 font-headline text-[12px] font-bold uppercase tracking-widest transition-colors
                          ${tab === t.k ? "text-light after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-t" : "text-muted hover:text-light"}`}>
                        {t.l}
                        <span className={`ml-1.5 font-headline text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.k ? "bg-primary/20 text-primary" : "bg-dark-lighter text-muted-dark"}`}>
                          {tabs[t.k].length}
                        </span>
                      </button>
                    ))}
                  </div>

                  {loading ? (
                    <div className="py-12 text-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <div className="font-headline text-sm text-muted uppercase tracking-widest">Loading…</div>
                    </div>
                  ) : displayed.length > 0 ? (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger-item">
                      {displayed.map(e => <EventCard key={e.id} e={e} />)}
                    </div>
                  ) : (
                    <div className="py-16 text-center border border-dashed border-dark-lighter rounded-lg">
                      <CalendarDays className="w-10 h-10 text-muted mx-auto mb-3 opacity-40" />
                      <div className="font-headline text-[15px] font-black italic text-light mb-1">
                        {tab === "upcoming" ? "No upcoming events" : tab === "past" ? "No past events" : "No drafts"}
                      </div>
                      <div className="text-[13px] text-muted mb-5">
                        {tab === "drafts" ? "Start drafting a new event listing." : tab === "upcoming" ? "Post a new event to get started." : "Completed events will appear here."}
                      </div>
                      {(tab === "upcoming" || tab === "drafts") && (
                        <Link href="/organiser/new-listing"
                          className="inline-flex items-center gap-2 bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-3 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform">
                          <Plus className="w-4 h-4" /> Create listing
                        </Link>
                      )}
                    </div>
                  )}

                  {displayed.length > 0 && (
                    <Link href="/organiser/new-listing"
                      className="group w-full mt-4 border border-dashed border-dark-lighter hover:border-primary/60 rounded-lg p-4 flex items-center justify-center gap-3 text-muted hover:text-primary transition-colors">
                      <Plus className="w-4 h-4" />
                      <span className="font-headline text-[11px] font-bold uppercase tracking-widest">Add another listing</span>
                    </Link>
                  )}
                </section>

                {/* ── SECTION 3: Photo gallery ── */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-headline text-xl font-black italic tracking-tighter text-light flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" /> Photos
                      </h2>
                      <p className="text-[12px] text-muted mt-0.5">Event highlights and action shots.</p>
                    </div>
                    {photos.length > 0 && (
                      <button className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary border border-dark-lighter hover:border-primary/50 px-3 py-1.5 rounded-md transition-colors">
                        Upload
                      </button>
                    )}
                  </div>
                  <PhotoCarousel photos={photos} isOrganiser />
                </section>

                {/* ── SECTION 4: Reviews ── */}
                <section>
                  <ReviewsSection
                    reviews={reviews}
                    organiserId={organiserId}
                    loading={reviewsLoading}
                    onNewReview={handleNewReview}
                  />
                </section>
              </div>

              {/* ── Right sidebar ── */}
              <aside className="space-y-4 lg:sticky lg:top-24 h-fit">

                {/* Public preview */}
                <div>
                  <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse-dot" /> Public preview
                  </div>
                  <div className="bg-dark rounded-xl border border-dark-lighter overflow-hidden">
                    <div className="relative h-20 hero-topo scan-grid" />
                    <div className="px-4 pb-4 -mt-6 relative">
                      <div className="w-12 h-12 rounded-lg bg-primary text-dark font-headline font-black italic text-2xl flex items-center justify-center border-3 border-dark mb-2">
                        {initial}
                      </div>
                      <div className="font-headline text-[16px] font-black italic tracking-tighter text-light">{profile.orgName || "Your Organisation"}</div>
                      <div className="flex items-center gap-1 font-headline text-[10px] uppercase tracking-widest text-primary mt-0.5">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </div>
                      {reviews.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="font-headline text-[11px] font-bold text-light">{avgRating.toFixed(1)}</span>
                          <span className="font-headline text-[10px] text-muted">({reviews.length})</span>
                        </div>
                      )}
                      {profile.bio && (
                        <p className="text-[12px] text-muted mt-2 leading-relaxed line-clamp-3">{profile.bio}</p>
                      )}
                      <div className="mt-3 pt-3 border-t border-dark-lighter space-y-1">
                        {profile.website && (
                          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted truncate">
                            <Globe className="w-3 h-3 text-primary shrink-0" /> {profile.website.replace(/https?:\/\//, "")}
                          </div>
                        )}
                        {profile.instagram && (
                          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted">
                            <Instagram className="w-3 h-3 text-primary" /> {profile.instagram}
                          </div>
                        )}
                        {profile.email && (
                          <div className="flex items-center gap-2 font-headline text-[10px] uppercase tracking-widest text-muted truncate">
                            <Mail className="w-3 h-3 text-primary shrink-0" /> {profile.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* About snippet */}
                {profile.bio && (
                  <div className="bg-dark border border-dark-lighter rounded-lg p-5">
                    <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted mb-2">About</div>
                    <p className="text-[13px] text-light leading-relaxed">{profile.bio}</p>
                  </div>
                )}

                {/* Rating snapshot */}
                {reviews.length > 0 && (
                  <div className="bg-dark border border-dark-lighter rounded-lg p-5">
                    <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Rating</div>
                    <div className="flex items-center gap-3">
                      <div className="font-headline text-[36px] font-black italic leading-none text-light">{avgRating.toFixed(1)}</div>
                      <div>
                        <div className="flex gap-0.5 mb-0.5">
                          {[1,2,3,4,5].map(i => (
                            <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(avgRating) ? "text-yellow-400" : "text-dark-lighter"}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <div className="font-headline text-[11px] uppercase tracking-widest text-muted">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { const el = document.getElementById("reviews"); el?.scrollIntoView({ behavior: "smooth" }); }}
                      className="mt-3 w-full text-left font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                    >
                      See all reviews →
                    </button>
                  </div>
                )}

                {/* Quick links */}
                <div className="bg-dark border border-dark-lighter rounded-lg p-4">
                  <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Quick links</div>
                  <div className="space-y-1">
                    <button onClick={() => setEditOpen(true)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-dark-light/50 group transition-colors">
                      <span className="font-headline text-[13px] font-bold text-light group-hover:text-primary transition-colors">Edit profile</span>
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                    </button>
                    <Link href="/organiser/listings"
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-dark-light/50 group transition-colors">
                      <span className="font-headline text-[13px] font-bold text-light group-hover:text-primary transition-colors">Manage all events</span>
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                    </Link>
                    <Link href="/organiser/new-listing"
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-dark-light/50 group transition-colors">
                      <span className="font-headline text-[13px] font-bold text-light group-hover:text-primary transition-colors">Post a new event</span>
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                    </Link>
                  </div>
                </div>

                {/* Tip */}
                <div className="bg-dark border border-dark-lighter rounded-lg p-5">
                  <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary mb-1.5">Tip</div>
                  <div className="text-[13px] text-light leading-relaxed">
                    Profiles with reviews get{" "}
                    <span className="text-primary font-semibold">3× more</span> registrations. Share your profile with attendees after each event.
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>

      {editOpen && (
        <EditPanel
          profile={profile} state={state} disciplines={disciplines}
          saving={saving} saved={saved} error={error}
          onChange={u} onStateChange={setState} onToggleDisc={toggleD}
          onSave={handleSave}
          onClose={() => { setEditOpen(false); setError(""); }}
        />
      )}
    </div>
  );
}
