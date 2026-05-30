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
import { useSettings } from "@/context/SettingsContext";

type EventStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

interface EventRow {
  id: string; title: string; discipline: string; city: string; state: string;
  eventDate: string; startTime: string; status: EventStatus; waves: { price: string }[];
  cap?: number | null; coverImageUrl?: string | null; isPinned?: boolean; registrationCount: number;
}

interface Profile {
  orgName: string; contactName: string; phone: string; contactEmail: string;
  facebook: string; bio: string; abn: string;
  logoUrl: string; logoPosition: string; coverImageUrl: string; coverPosition: string;
}

interface ReviewData {
  id: string; reviewerName: string; eventTitle?: string | null;
  overallRating: number; communicationRating?: number | null;
  organisationRating?: number | null; experienceRating?: number | null;
  title: string; body: string; isVerified: boolean; createdAt: string;
}


const EMPTY: Profile = {
  orgName: "", contactName: "", phone: "", contactEmail: "",
  facebook: "", bio: "", abn: "", logoUrl: "", logoPosition: "50% 50%", coverImageUrl: "", coverPosition: "50% 50%",
};

const STATUS_STYLE: Record<EventStatus, { bg: string; text: string; dot: string; label: string; pulse?: boolean }> = {
  APPROVED: { bg: "bg-lime-50",   text: "text-lime-700",  dot: "bg-lime-500",  label: "Published",     pulse: true },
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



export default function ProfilePage() {
  const { open: openSettings, profileSavedAt } = useSettings();

  const [profile,       setProfile]       = useState<Profile>(EMPTY);
  const [events,        setEvents]        = useState<EventRow[]>([]);
  const [pinnedIds,     setPinnedIds]     = useState<string[]>([]);
  const [avgRating,     setAvgRating]     = useState<number | null>(null);
  const [reviewCount,   setReviewCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
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
          logoPosition:  prof.logoPosition   ?? "50% 50%",
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
  }, [profileSavedAt]);

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

  const reviewStats = useMemo(() => {
    if (reviews.length === 0) return null;
    const total     = reviews.length;
    const avgOverall = reviews.reduce((s, r) => s + r.overallRating, 0) / total;
    const commRevs   = reviews.filter(r => r.communicationRating);
    const orgRevs    = reviews.filter(r => r.organisationRating);
    const expRevs    = reviews.filter(r => r.experienceRating);
    return {
      total,
      avgOverall,
      avgComm: commRevs.length ? commRevs.reduce((s, r) => s + (r.communicationRating ?? 0), 0) / commRevs.length : null,
      avgOrg:  orgRevs.length  ? orgRevs.reduce((s, r)  => s + (r.organisationRating  ?? 0), 0) / orgRevs.length  : null,
      avgExp:  expRevs.length  ? expRevs.reduce((s, r)  => s + (r.experienceRating    ?? 0), 0) / expRevs.length  : null,
      recommend: Math.round((reviews.filter(r => r.overallRating >= 4).length / total) * 100),
      dist: [5,4,3,2,1].map(star => ({
        star,
        count: reviews.filter(r => r.overallRating === star).length,
        pct:   Math.round((reviews.filter(r => r.overallRating === star).length / total) * 100),
      })),
    };
  }, [reviews]);

  const togglePin = useCallback(async (id: string) => {
    const nowPinned = !pinnedIds.includes(id);
    setPinnedIds(prev => nowPinned ? [...prev, id] : prev.filter(x => x !== id));
    try {
      await fetch(`/api/organiser/events/${id}/pin`, { method: "PATCH" });
    } catch {
      setPinnedIds(prev => nowPinned ? prev.filter(x => x !== id) : [...prev, id]);
    }
  }, [pinnedIds]);


  const uploadImage = async (file: File, type: string) => {
    const fd = new FormData();
    fd.append("file", file); fd.append("type", type);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed.");
    const { fileUrl } = await res.json();
    return fileUrl as string;
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const uploadType = file.type.startsWith("video/") ? "video" : "photo";
      const fileUrl = await uploadImage(file, uploadType);
      const updated = [...profilePhotos, fileUrl];
      await fetch("/api/organiser/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, photos: updated }),
      });
      setProfilePhotos(updated);
    } catch {
      // photo upload failed silently
    } finally { setPhotoUploading(false); }
  };

  const initial = (profile.orgName || "O").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-16 page-in pb-24 lg:pb-0">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10">

          {/* Banner */}
          <div className="relative h-36 sm:h-48 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 mt-4 sm:mt-6">
            {profile.coverImageUrl
              ? <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" style={{ objectPosition: profile.coverPosition || "50% 50%" }} />
              : <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)" }} />
            }
          </div>

          {/* Avatar + name row — avatar overlaps banner, name sits beside it below the cover */}
          <div className="flex items-end gap-4 -mt-[72px] mb-5 relative z-10">
            <div className="w-[144px] h-[144px] rounded-2xl bg-lime-400 text-gray-900 font-headline font-black italic text-5xl flex items-center justify-center border-4 border-white shadow-lg overflow-hidden shrink-0">
              {profile.logoUrl
                ? <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" style={{ objectPosition: profile.logoPosition || "50% 50%" }} />
                : initial}
            </div>

            {/* Name + actions sit below the cover line (at the avatar's bottom) */}
            <div className="min-w-0 pb-1">
              <h1 className="font-headline text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-tighter text-gray-900 leading-tight">
                {loading ? "Loading…" : (profile.orgName || "Your Organisation")}
              </h1>
              {profile.facebook && (
                <a href={profile.facebook} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1 font-headline text-[11px] uppercase tracking-widest text-gray-400 hover:text-gray-700 transition-colors">
                  <Facebook className="w-3 h-3" /> {profile.facebook.replace(/https?:\/\/(www\.)?/, "")}
                </a>
              )}
              <div className="flex items-center gap-2 mt-2.5">
                <Button variant="outline" size="sm" onClick={() => openSettings("personal")}>
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </Button>
                <Button asChild size="sm">
                  <Link href="/organiser/new-listing">
                    <Plus className="w-4 h-4" /> Post event
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3 mb-5 pb-5 border-b border-gray-200">
            <div className="text-center">
              <div className="font-headline text-xl sm:text-2xl font-black italic tracking-tighter text-gray-900">
                {loading ? "—" : events.filter(e => e.status === "APPROVED").length}
              </div>
              <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">Events</div>
            </div>
            <div className="text-center">
              <div className="font-headline text-xl sm:text-2xl font-black italic tracking-tighter text-gray-900">
                {avgRating !== null ? avgRating.toFixed(1) : "—"}
              </div>
              <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">Rating</div>
            </div>
            <div className="text-center">
              <div className="font-headline text-xl sm:text-2xl font-black italic tracking-tighter text-gray-900">0</div>
              <div className="font-headline text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">Followers</div>
            </div>
          </div>

          {/* Bio */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            {profile.bio
              ? <p className="text-[14px] text-gray-700 leading-relaxed">{profile.bio}</p>
              : <p className="text-[14px] text-gray-400 italic">No bio yet — add one in Edit Profile.</p>}
          </div>

          {/* Main content */}
          <div className="pb-16 space-y-10">

            {/* ── Events ── */}
            <section>
              {events.filter(e => e.status === "APPROVED").length > 3 && (
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
              ) : events.filter(e => e.status === "APPROVED").length === 0 ? (
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
                      const visible = events.filter(e => e.status === "APPROVED");
                      const shown = showAllEvents ? visible : visible.slice(0, 3);
                      return shown.map(e => {
                        const s     = STATUS_STYLE[e.status];
                        const price = (e.waves as { price: string }[])?.[0]?.price;
                        return (
                          <Link key={e.id} href={`/organiser/events/${e.id}/dashboard`}
                            className="group overflow-hidden rounded-xl transition-all duration-200">
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
                                {e.discipline.replace(/_/g, " ")}
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

            {/* ── Photos ── */}
            <section className="overflow-hidden">
              <PhotoCarousel
                photos={photos}
                isOrganiser
                onUpload={handlePhotoUpload}
                uploading={photoUploading}
              />
            </section>

            {/* ── Reviews ── */}
            <section>
              {!reviewStats ? (
                <div className="py-12 text-center border-t border-gray-200">
                  <div className="font-headline text-[15px] font-black italic text-gray-900 mb-1">No reviews yet</div>
                  <div className="text-[13px] text-gray-400">Reviews from athletes will appear here.</div>
                </div>
              ) : (
                <>
                  {/* Stats panel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 border-b border-gray-200 mb-6">

                    {/* Left — overall + star distribution */}
                    <div className="flex items-start gap-6">
                      <div className="shrink-0 text-center">
                        <div className="font-headline text-[56px] font-black italic tracking-tighter leading-none text-gray-900">
                          {reviewStats.avgOverall.toFixed(1)}
                        </div>
                        <div className="flex items-center justify-center gap-0.5 my-1.5">
                          {[1,2,3,4,5].map(i => (
                            <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(reviewStats.avgOverall) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400">
                          {reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="flex-1 space-y-1.5 pt-1">
                        {reviewStats.dist.map(({ star, count, pct }) => (
                          <div key={star} className="flex items-center gap-2">
                            <div className="font-headline text-[11px] font-bold text-gray-500 w-4 text-right shrink-0">{star}</div>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="font-headline text-[10px] text-gray-400 w-5 shrink-0">{count}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right — subcategories + recommend */}
                    <div className="flex flex-col justify-between gap-5">
                      <div className="grid grid-cols-3 gap-3">
                        {([
                          { label: "Communication", value: reviewStats.avgComm },
                          { label: "Organisation",  value: reviewStats.avgOrg  },
                          { label: "Experience",    value: reviewStats.avgExp  },
                        ] as { label: string; value: number | null }[]).map(({ label, value }) => (
                          <div key={label} className="text-center py-3 border-b border-gray-200">
                            <div className="font-headline text-2xl font-black italic tracking-tighter text-gray-900">
                              {value !== null ? value.toFixed(1) : "—"}
                            </div>
                            <div className="font-headline text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Review list */}
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
                </>
              )}
            </section>

          </div>
        </div>
      </main>

    </div>
  );
}
