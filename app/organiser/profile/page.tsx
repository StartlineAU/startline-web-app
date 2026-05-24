"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus, MapPin, ArrowRight, CheckCircle,
  Phone, Mail, X, Edit2, Camera, CalendarDays, Facebook, Upload, Move,
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
  facebook: string; bio: string; abn: string;
  logoUrl: string; coverImageUrl: string; coverPosition: string;
}

interface ReviewData {
  id: string; reviewerName: string; eventTitle?: string | null;
  overallRating: number; title: string; body: string; isVerified: boolean; createdAt: string;
}

const EMPTY: Profile = {
  orgName: "", contactName: "", phone: "", contactEmail: "",
  facebook: "", bio: "", abn: "", logoUrl: "", coverImageUrl: "", coverPosition: "50% 50%",
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

// ── CoverEditor ────────────────────────────────────────────────────────────────

interface CoverEditorProps {
  imageUrl:          string;
  position:          string;
  uploading:         boolean;
  onUpload:          (f: File) => void;
  onPositionChange:  (pos: string) => void;
  fileRef:           React.RefObject<HTMLInputElement | null>;
}

function CoverEditor({ imageUrl, position, uploading, onUpload, onPositionChange, fileRef }: CoverEditorProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reposition, setReposition] = useState(false);
  const dragStart      = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const parsePos = (pos: string) => {
    const [x, y] = pos.split(" ").map(v => parseFloat(v));
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!reposition || !imageUrl) return;
    e.preventDefault();
    const { x, y } = parsePos(position);
    dragStart.current = { x: e.clientX, y: e.clientY, px: x, py: y };
    setDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current || !containerRef.current) return;
    const rect   = containerRef.current.getBoundingClientRect();
    const dx     = ((e.clientX - dragStart.current.x) / rect.width)  * -100;
    const dy     = ((e.clientY - dragStart.current.y) / rect.height) * -100;
    const newX   = Math.min(100, Math.max(0, dragStart.current.px + dx));
    const newY   = Math.min(100, Math.max(0, dragStart.current.py + dy));
    onPositionChange(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
  };

  const onMouseUp = () => setDragging(false);

  if (!imageUrl) {
    return (
      <div
        className="relative h-28 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 cursor-pointer group"
        onClick={() => fileRef.current?.click()}
      >
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 rounded-lg px-3 py-2 flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-gray-700">
            {uploading
              ? <><div className="w-3.5 h-3.5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" /> Uploading…</>
              : <><Upload className="w-3.5 h-3.5" /> Upload cover</>
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        className={`relative h-28 rounded-xl overflow-hidden border border-gray-200 select-none ${reposition ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <img
          src={imageUrl}
          alt="Cover"
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: position }}
          draggable={false}
        />

        {/* Reposition mode overlay */}
        {reposition && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/60 text-white rounded-lg px-3 py-1.5 font-headline text-[11px] font-bold uppercase tracking-wider">
              <Move className="w-3.5 h-3.5" /> Drag to reposition
            </div>
          </div>
        )}
      </div>

      {/* Controls below the preview */}
      <div className="flex items-center gap-2 mt-2">
        {reposition ? (
          <button
            onClick={() => setReposition(false)}
            className="font-headline text-[11px] font-bold uppercase tracking-widest bg-lime-400 text-gray-900 px-3 py-1.5 rounded-md hover:bg-lime-500 transition-colors"
          >
            Done
          </button>
        ) : (
          <button
            onClick={() => setReposition(true)}
            className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
          >
            <Move className="w-3 h-3" /> Reposition
          </button>
        )}
        <span className="text-gray-300 text-xs">·</span>
        <button
          onClick={() => { setReposition(false); fileRef.current?.click(); }}
          disabled={uploading}
          className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors disabled:opacity-40"
        >
          <Upload className="w-3 h-3" /> {uploading ? "Uploading…" : "Change photo"}
        </button>
      </div>
    </div>
  );
}

interface EditPanelProps {
  profile:        Profile;
  saving:         boolean;
  saved:          boolean;
  error:          string;
  logoUploading:  boolean;
  coverUploading: boolean;
  onChange:       (patch: Partial<Profile>) => void;
  onLogoUpload:   (f: File) => void;
  onCoverUpload:  (f: File) => void;
  onSave:         () => void;
  onClose:        () => void;
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-4">
      {label}
    </div>
  );
}

function EditPanel({
  profile, saving, saved, error,
  logoUploading, coverUploading,
  onChange, onLogoUpload, onCoverUpload, onSave, onClose,
}: EditPanelProps) {
  const logoRef  = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const initial = (profile.orgName || "O").charAt(0).toUpperCase();

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm overlay-in" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] bg-white border-l border-gray-200 flex flex-col modal-in overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div>
            <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900">Edit Profile</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">Changes are reflected on your public listing page.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">

          {/* ── Photos ── */}
          <div>
            <SectionHeading label="Photos" />

            {/* Cover photo */}
            <div className="mb-4">
              <FieldLabel label="Cover photo" hint="Recommended 1200×400" />
              <CoverEditor
                imageUrl={profile.coverImageUrl}
                position={profile.coverPosition}
                uploading={coverUploading}
                onUpload={onCoverUpload}
                onPositionChange={pos => onChange({ coverPosition: pos })}
                fileRef={coverRef}
              />
              <input ref={coverRef} type="file" accept="image/*" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) onCoverUpload(f); }} />
            </div>

            {/* Profile photo */}
            <div>
              <FieldLabel label="Profile photo" />
              <div className="flex items-center gap-4">
                <div
                  className="relative w-16 h-16 rounded-xl overflow-hidden bg-lime-400 flex items-center justify-center cursor-pointer group border border-gray-200 shrink-0"
                  onClick={() => logoRef.current?.click()}
                >
                  {profile.logoUrl
                    ? <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    : <span className="font-headline font-black italic text-2xl text-gray-900">{initial}</span>
                  }
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                    {logoUploading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    }
                  </div>
                </div>
                <div>
                  <button onClick={() => logoRef.current?.click()} disabled={logoUploading}
                    className="font-headline text-[12px] font-bold uppercase tracking-widest text-gray-700 hover:text-lime-600 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> {logoUploading ? "Uploading…" : "Upload new photo"}
                  </button>
                  <p className="text-[11px] text-gray-400 mt-0.5">PNG or JPG, square recommended.</p>
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); }} />
              </div>
            </div>
          </div>

          {/* ── Organisation ── */}
          <div>
            <SectionHeading label="Organisation" />
            <div className="space-y-4">
              <div>
                <FieldLabel label="Organisation name" required />
                <FInput value={profile.orgName} onChange={e => onChange({ orgName: e.target.value })} placeholder="e.g. Endurance Events Australia" />
              </div>
              <div>
                <FieldLabel label="About" hint={`${profile.bio.length}/600`} />
                <FTextarea rows={4} maxLength={600} value={profile.bio} onChange={e => onChange({ bio: e.target.value })} placeholder="Tell athletes what you run and who you are…" />
              </div>
            </div>
          </div>

          {/* ── Contact ── */}
          <div>
            <SectionHeading label="Contact" />
            <div className="space-y-4">
              <div>
                <FieldLabel label="Contact name" required />
                <FInput value={profile.contactName} onChange={e => onChange({ contactName: e.target.value })} placeholder="Full name" />
              </div>
              <div>
                <FieldLabel label="Contact email" required />
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <FInput className="pl-9" type="email" value={profile.contactEmail} onChange={e => onChange({ contactEmail: e.target.value })} placeholder="events@yourorg.com.au" />
                </div>
              </div>
              <div>
                <FieldLabel label="Phone" />
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <FInput className="pl-9" type="tel" value={profile.phone} onChange={e => onChange({ phone: e.target.value })} placeholder="+61 4xx xxx xxx" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Security ── */}
          <div>
            <SectionHeading label="Security" />
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200">
              <div>
                <div className="font-headline text-[13px] font-bold text-gray-900 mb-0.5">Password</div>
                <div className="text-[11px] text-gray-400">Update your login credentials.</div>
              </div>
              <Button variant="outline" size="sm">Change</Button>
            </div>
          </div>

        </div>

        {/* Footer */}
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
  const [events,        setEvents]        = useState<EventRow[]>([]);
  const [pinnedIds,     setPinnedIds]     = useState<string[]>([]);
  const [avgRating,     setAvgRating]     = useState<number | null>(null);
  const [reviewCount,   setReviewCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [editOpen,      setEditOpen]      = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState("");
  const [logoUploading,  setLogoUploading]  = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profilePhotos,  setProfilePhotos]  = useState<string[]>([]);
  const [showAllEvents,  setShowAllEvents]  = useState(false);
  const [reviews,        setReviews]        = useState<ReviewData[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/organiser/profile").then(r => r.json()),
      fetch("/api/organiser/events").then(r => r.json()),
    ]).then(([prof, evts]) => {
      if (prof && !prof.error) {
        setProfile({
          orgName:       prof.orgName       ?? "",
          contactName:   prof.contactName   ?? "",
          phone:         prof.phone         ?? "",
          contactEmail:  prof.contactEmail  ?? "",
          facebook:      prof.facebook      ?? "",
          bio:           prof.bio           ?? "",
          abn:           prof.abn           ?? "",
          logoUrl:       prof.logoUrl        ?? "",
          coverImageUrl: prof.coverImageUrl  ?? "",
          coverPosition: prof.coverPosition  ?? "50% 50%",
        });
      }
      if (prof && Array.isArray(prof.photos)) setProfilePhotos(prof.photos);
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
    () => [
      ...profilePhotos,
      ...events.map(e => e.coverImageUrl).filter((u): u is string => !!u),
    ],
    [profilePhotos, events],
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

  const uploadImage = async (file: File, type: "logo" | "cover") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed.");
    const { fileUrl } = await res.json();
    return fileUrl as string;
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const fileUrl = await uploadImage(file, "logo");
      await fetch("/api/organiser/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, logoUrl: fileUrl }),
      });
      setProfile(p => ({ ...p, logoUrl: fileUrl }));
    } catch {
      setError("Logo upload failed. Please try again.");
    } finally { setLogoUploading(false); }
  };

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const fileUrl = await uploadImage(file, "cover");
      await fetch("/api/organiser/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, coverImageUrl: fileUrl }),
      });
      setProfile(p => ({ ...p, coverImageUrl: fileUrl }));
    } catch {
      setError("Cover upload failed. Please try again.");
    } finally { setCoverUploading(false); }
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const fileUrl = await uploadImage(file, "photo");
      const updated = [...profilePhotos, fileUrl];
      await fetch("/api/organiser/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, photos: updated }),
      });
      setProfilePhotos(updated);
    } catch {
      setError("Photo upload failed. Please try again.");
    } finally { setPhotoUploading(false); }
  };

  const initial = (profile.orgName || "O").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-16 page-in pb-24 lg:pb-0">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10">

          {/* Banner — contained */}
          <div className="relative h-36 sm:h-44 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 mt-6">
            {profile.coverImageUrl
              ? <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" style={{ objectPosition: profile.coverPosition || "50% 50%" }} />
              : <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)" }} />
            }
          </div>

          {/* Avatar + Name row — avatar overlaps bottom of banner, name sits beside it */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 mb-6 relative z-10">
            <div className="flex items-end gap-4">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-xl bg-lime-400 text-gray-900 font-headline font-black italic text-4xl flex items-center justify-center border-4 border-white shadow-md overflow-hidden">
                  {profile.logoUrl
                    ? <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    : initial}
                </div>
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
                {profile.facebook && (
                  <a href={profile.facebook} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 font-headline text-[11px] uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors">
                    <Facebook className="w-3 h-3" /> {profile.facebook.replace(/https?:\/\/(www\.)?/, "")}
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
            <section className="bg-white rounded-xl border border-gray-200">
              {events.filter(e => e.status !== "ARCHIVED").length > 3 && (
                <div className="flex justify-end px-5 pt-4">
                  <button
                    onClick={() => setShowAllEvents(v => !v)}
                    className="font-headline text-[11px] uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1">
                    {showAllEvents ? "Show less" : "View all"}
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform duration-300 ${showAllEvents ? "-rotate-90" : "rotate-90"}`} />
                  </button>
                </div>
              )}

              {loading ? (
                <div className="py-10 text-center">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
                </div>
              ) : events.filter(e => e.status !== "ARCHIVED").length === 0 ? (
                <div className="py-14 text-center">
                  <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <div className="font-headline text-[15px] font-black italic text-gray-900 mb-1">No events yet</div>
                  <div className="text-[13px] text-gray-400 mb-5">Post your first event to get started.</div>
                  <Button asChild size="sm">
                    <Link href="/organiser/new-listing"><Plus className="w-4 h-4" /> Add new event</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
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
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <PhotoCarousel
                photos={photos}
                isOrganiser
                onUpload={handlePhotoUpload}
                uploading={photoUploading}
              />
            </section>

            {/* Reviews */}
            <section className="bg-white rounded-xl border border-gray-200">
              {reviews.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="font-headline text-[15px] font-black italic text-gray-900 mb-1">No reviews yet</div>
                  <div className="text-[13px] text-gray-400">Reviews from athletes will appear here.</div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {reviews.map(r => (
                    <div key={r.id} className="p-5">
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
          profile={profile}
          saving={saving} saved={saved} error={error}
          logoUploading={logoUploading} coverUploading={coverUploading}
          onChange={u}
          onLogoUpload={handleLogoUpload}
          onCoverUpload={handleCoverUpload}
          onSave={handleSave}
          onClose={() => { setEditOpen(false); setError(""); }}
        />
      )}
    </div>
  );
}
