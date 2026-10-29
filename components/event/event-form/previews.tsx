"use client";

import { useState, useRef, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2,
  Upload, X, MapPin, Calendar, Users,
  ChevronDown, ChevronUp, Clock, Eye,
  Ticket, ExternalLink, DollarSign, Bold, Italic, Underline,
  AlignLeft, Trophy, FileText, AlertTriangle,
} from "lucide-react";
import { encodePrizePool, parsePrizePool, normalisePrizeAmount } from "@/lib/prize-pool";
import { UPLOAD_LIMITS, TYPE_MIMES } from "@/lib/upload-limits";
import { uploadFile, UploadError } from "@/lib/upload-client";
import { formatDivisionLabel } from "@/lib/divisions";
import { DEFAULT_REFUND_TIERS, REFUND_PRESETS, describeTiers, matchRefundPreset, parseTiers, tiersAreValid, type RefundTier } from "@/lib/refund-policy";
import { isFreeEvent } from "@/lib/event-types";
import { takesPayments } from "@/lib/event-approval";
import { customerHref } from "@/lib/portal-domains";
import { usePortalHost } from "@/lib/use-portal-host";
import AddressAutocomplete  from "@/components/ui/AddressAutocomplete";
import SuburbAutocomplete   from "@/components/ui/SuburbAutocomplete";
import LocationPreviewMap   from "@/components/organiser/LocationPreviewMap";
import DatePicker           from "@/components/ui/DatePicker";
import SelectMenu           from "@/components/ui/SelectMenu";
import TimePicker           from "@/components/ui/TimePicker";

/* ── Step definitions ───────────────────────────────────────── */

import {
  fmt24to12, stripHtml,
  type FormState,
} from "./shared";

const INTENSITY_LABELS: Record<string, string> = {
  low: "Low", moderate: "Moderate", high: "High", extreme: "Extreme",
};

export const DISC_LABEL: Record<string, string> = {
  crossfit: "CrossFit", running: "Running", hybrid: "Hybrid",
  cycling: "Cycling", swimming: "Swimming", other: "Other",
};
export const MONTHS_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export function LivePreview({ form }: { form: FormState }) {
  const sp    = (form.date || "").split("-");
  const sDay  = sp[2] || null;
  const sMon  = sp[1] ? MONTHS_SHORT[parseInt(sp[1]) - 1] : null;
  const price = form.waves.find(w => w.price === "0" || !!w.price)?.price;
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = form.coverImage ? URL.createObjectURL(form.coverImage) : form.coverImageUrl || null;
    startTransition(() => setCoverSrc(url));
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [form.coverImage, form.coverImageUrl]);
  const descriptionText = stripHtml(form.description || "");

  return (
    <div>
      {/* Desktop sidebar only. On a phone the card sits inside the "Event
          preview" toggle, which already names it. */}
      <span className="hidden lg:block font-headline text-[11px] font-bold uppercase tracking-widest text-primary/70 mb-4">
        Live preview
      </span>

      {/* Card — matches HomeEventCard */}
      <div className="bg-dark border border-dark-lighter rounded-2xl overflow-hidden">

        {/* Image */}
        <div className="relative w-full aspect-video overflow-hidden rounded-t-2xl">
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt=""
              fill
              unoptimized
              className="object-cover brightness-[0.55]"
            />
          ) : (
            <div className="absolute inset-0 placeholder-stripes scan-grid" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark/60 via-transparent to-transparent" />

          {/* DRAFT badge */}
          <div className="absolute top-3 left-3">
            <span className="font-headline text-[10px] font-medium uppercase tracking-widest bg-primary text-dark px-2.5 py-1 rounded-full">
              Draft
            </span>
          </div>

          {/* Date badge */}
          {sDay && sMon && (
            <div className="absolute top-3 right-3 bg-dark-light/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center leading-tight">
              <span className="block font-headline text-[9px] font-bold uppercase tracking-widest text-light">{sMon}</span>
              <span className="block font-headline text-xl font-black text-light leading-none mt-0.5">{sDay}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {form.discipline && (
            <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
              {DISC_LABEL[form.discipline]}
            </span>
          )}
          <h3 className="font-headline text-lg sm:text-xl font-black italic tracking-tighter text-light leading-tight mb-3 line-clamp-2">
            {form.title || <span className="text-light/40">Event title...</span>}
          </h3>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-light">
              <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="truncate">
                {form.city || form.state
                  ? [form.city, form.state ? form.state.toUpperCase() : ""].filter(Boolean).join(", ")
                  : "Venue TBC"}
              </span>
            </div>
            <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-light">
              <Clock className="w-3 h-3 text-primary flex-shrink-0" />
              <span>{form.startTime ? fmt24to12(form.startTime) : "Time TBC"}</span>
            </div>
            {form.format && (
              <div className="flex items-center gap-2 font-headline text-[10px] font-medium uppercase tracking-widest text-light">
                <Users className="w-3 h-3 text-primary flex-shrink-0" />
                <span>
                  {form.format === "both"        ? "Individual & Team"
                  : form.format === "individual"  ? "Individual"
                  :                                "Team"}
                </span>
              </div>
            )}
          </div>

          {descriptionText && (
            <p className="font-headline text-xs text-light leading-relaxed line-clamp-2 mb-3">
              {descriptionText}
            </p>
          )}

          {(price === "0" || !!price) && (
            <span className="font-headline text-sm font-bold text-primary">
              {price === "0" ? "Free" : `From $${price}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FULL EVENT PAGE PREVIEW
   ══════════════════════════════════════════════════════════════ */
export const FORMAT_LABELS_PREVIEW: Record<string, string> = {
  individual: "Individual", team: "Team / Pairs", both: "Individual & Team",
};

export function EventFullPreview({ form, onClose }: { form: FormState; onClose: () => void }) {
  const discipline  = DISC_LABEL[form.discipline] || "";
  const stateLabel  = form.state ? form.state.toUpperCase() : "";
  const formatLabel = FORMAT_LABELS_PREVIEW[form.format] || "—";
  const intensity   = form.level ? INTENSITY_LABELS[form.level] : "—";

  // Mirrors formatEventDate / formatEventDateRange on the public event page.
  const dateLabel = (() => {
    if (!form.date) return "Date TBC";
    const s = new Date(form.date + "T00:00:00");
    if (form.endDate && form.endDate !== form.date) {
      const e = new Date(form.endDate + "T00:00:00");
      if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
        return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}`;
      }
      return `${s.toLocaleDateString("en-AU", { day: "numeric", month: "long" })} — ${e.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`;
    }
    return s.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  })();

  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  const drops = form.waves
    .filter(w => w.price === "0" || !!w.price)
    .map(w => ({ ...w, isClosed: !!w.closes && w.closes < today }));
  const fmtCloseDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = form.coverImage ? URL.createObjectURL(form.coverImage) : form.coverImageUrl;
    startTransition(() => setCoverSrc(url || null));
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [form.coverImage, form.coverImageUrl]);

  const [photoSrcs, setPhotoSrcs] = useState<string[]>([]);
  useEffect(() => {
    const urls = form.photos.map(f => URL.createObjectURL(f));
    startTransition(() => setPhotoSrcs(urls));
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [form.photos]);
  const gallery = [...form.photoUrls, ...photoSrcs];

  const prizeAmount = form.prizeMoney ? normalisePrizeAmount(form.prizeMoneyAmount) : "";
  const cap = form.cap ? parseInt(form.cap) : null;

  // The preview covers the whole screen, so on a phone the back swipe is the
  // obvious way out of it. Opening adds a history entry for the preview, which
  // makes Back close the preview instead of leaving the wizard and losing the
  // event. Close goes through the same entry so none is left behind.
  const pushedEntry = useRef(false);
  useEffect(() => {
    if (!pushedEntry.current && !window.history.state?.eventPreview) {
      window.history.pushState({ ...window.history.state, eventPreview: true }, "");
    }
    pushedEntry.current = true;
    window.addEventListener("popstate", onClose);
    return () => window.removeEventListener("popstate", onClose);
  }, [onClose]);
  const close = () => window.history.back();

  return (
    // Above the site nav (z-50), with an opaque bar: the nav's logo used to
    // show through the preview's header.
    <div className="fixed inset-0 z-[60] flex flex-col overlay-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={close} />
      <div className="relative flex flex-col w-full h-full overflow-hidden modal-in">
        <div className="relative z-10 flex items-center justify-between px-5 py-3 bg-dark-darker border-b border-dark-lighter shrink-0">
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-primary" />
            <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Athlete view preview</span>
            <span className="font-headline text-[10px] uppercase tracking-widest text-light hidden sm:block">This is how your listing will appear to athletes</span>
          </div>
          <button onClick={close}
            className="flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-light hover:text-light transition-colors">
            <X className="w-4 h-4" /> Close preview
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto bg-dark-darker">

          {/* ── Banner — mirrors the public event page ── */}
          <div className="relative overflow-hidden w-full" style={{ aspectRatio: "4/3", maxHeight: "420px" }}>
            {coverSrc ? (
              <Image src={coverSrc} alt="" fill unoptimized className="object-cover" />
            ) : (
              <div className="absolute inset-0 placeholder-stripes scan-grid" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-darker via-darker/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {discipline && (
                  <span className="inline-block font-headline text-[10px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-1 rounded-full">
                    {discipline}
                  </span>
                )}
                <span className="inline-block font-headline text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 px-2.5 py-1 rounded-full">
                  Draft
                </span>
              </div>
              <h1 className="font-headline text-[28px] sm:text-4xl lg:text-5xl font-black italic tracking-tighter text-light leading-tight mb-2">
                {form.title || "Your event title"}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-light">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {form.venue || form.city || "Venue TBC"}{stateLabel ? `, ${stateLabel}` : ""}
                </span>
                <span className="flex items-center gap-1.5 font-headline text-xs font-medium uppercase tracking-widest text-light">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {dateLabel}
                </span>
              </div>
            </div>
          </div>

          <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

              {/* ── Main content ── */}
              <div className="order-2 lg:order-none lg:col-span-2 space-y-6 sm:space-y-8">

                <div>
                  <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Event Overview</h2>
                  {form.description ? (
                    <div
                      className="text-sm font-medium text-light leading-relaxed
                        [&_h3]:font-headline [&_h3]:font-black [&_h3]:text-base [&_h3]:text-light [&_h3]:mt-4 [&_h3]:mb-1
                        [&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-sm [&_h4]:text-light [&_h4]:mt-3 [&_h4]:mb-1
                        [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5"
                      dangerouslySetInnerHTML={{ __html: form.description }}
                    />
                  ) : (
                    <p className="text-sm font-medium text-light italic">Full description will appear here.</p>
                  )}
                </div>

                {prizeAmount && (
                  <div className="bg-dark rounded-xl px-5 sm:px-6 py-5 flex items-center gap-4">
                    <Trophy className="w-7 h-7 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-headline text-xl font-black text-primary leading-tight">
                        ${prizeAmount} prize pool
                      </p>
                      {form.prizeMoneyDetails.trim() && (
                        <p className="font-headline text-[11px] font-medium uppercase tracking-widest text-light mt-1">
                          {form.prizeMoneyDetails.trim()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {drops.length > 0 && (
                  <div>
                    <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Pricing</h2>
                    <div className="space-y-2">
                      {drops.map((w, i) => (
                        <div key={i} className={`flex items-center justify-between bg-dark rounded-xl px-4 sm:px-6 py-4 ${w.isClosed ? "opacity-50" : ""}`}>
                          <div>
                            <p className="font-headline text-sm font-bold text-light flex items-center gap-2 flex-wrap">
                              {w.label || "General admission"}
                              {w.isClosed && (
                                <span className="font-headline text-[9px] font-bold uppercase tracking-widest text-light border border-dark-lighter px-2 py-0.5 rounded-full">
                                  Closed
                                </span>
                              )}
                            </p>
                            {w.startTime && (
                              <p className="font-headline text-xs text-light uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Wave start {fmt24to12(w.startTime)}
                              </p>
                            )}
                            {w.closes && (
                              <p className="font-headline text-xs text-light uppercase tracking-widest mt-0.5">
                                {w.isClosed ? "Closed" : "Closes"} {fmtCloseDate(w.closes)}
                              </p>
                            )}
                          </div>
                          <span className={`font-headline text-2xl font-black italic ${w.isClosed ? "text-light line-through" : "text-primary"}`}>
                            {w.price === "0" ? "Free" : `$${w.price}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {gallery.length > 0 && (
                  <div>
                    <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Gallery</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      {gallery.map((src, i) => (
                        <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-dark">
                          <Image src={src} alt="" fill unoptimized className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* ── Sidebar: CTAs + details ── */}
              <div className="order-1 lg:order-none space-y-4">
                <div className="flex flex-col gap-3">
                  <span className="w-full flex items-center justify-center gap-2 bg-machined shadow-machined text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md cursor-default">
                    Register Now
                    {form.registrationType === "external" ? <ExternalLink className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                  </span>
                  <span className="w-full flex items-center justify-center gap-2 border border-dark-lighter text-light font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md cursor-default">
                    View on Maps
                    <MapPin className="w-4 h-4" />
                  </span>
                </div>

                <div className="bg-dark rounded-xl p-5 sm:p-6">
                  <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-light mb-4">Event Details</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-light mb-0.5">Date</p>
                      <p className="font-headline text-base font-black italic text-light">{dateLabel}</p>
                    </div>
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-light mb-0.5">Time</p>
                      <p className="font-headline text-base font-black italic text-light">
                        {form.startTime ? fmt24to12(form.startTime) : "TBC"}
                        {form.endTime && ` — ${fmt24to12(form.endTime)}`}
                      </p>
                    </div>
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-light mb-0.5">Location</p>
                      <p className="font-headline text-base font-black italic text-light">{form.venue || "Venue TBC"}</p>
                      {form.address && (
                        <p className="font-headline text-xs text-light uppercase tracking-widest mt-0.5">{form.address}</p>
                      )}
                      {form.city && (
                        <p className="font-headline text-xs text-light uppercase tracking-widest mt-0.5">{form.city}{stateLabel ? `, ${stateLabel}` : ""}</p>
                      )}
                    </div>
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-light mb-0.5">Format</p>
                      <p className="font-headline text-base font-black italic text-light">{formatLabel}</p>
                    </div>
                    {form.categories.length > 0 && (
                      <div>
                        <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-light mb-1">Divisions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {form.categories.map(c => (
                            <span key={c} className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2 py-1 rounded-md">
                              {formatDivisionLabel(c)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-light mb-0.5">Intensity</p>
                      <p className="font-headline text-base font-black italic text-light">{intensity}</p>
                    </div>
                    {(cap != null || form.minAge !== "") && (
                      <div className="grid grid-cols-2 gap-3">
                        {cap != null && (
                          <div>
                            <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-light mb-0.5">Participant Cap</p>
                            <p className="font-headline text-base font-black italic text-light">{cap > 0 ? cap.toLocaleString() : "Open"}</p>
                          </div>
                        )}
                        {form.minAge !== "" && (
                          <div>
                            <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-light mb-0.5">Minimum Age</p>
                            <p className="font-headline text-base font-black italic text-light">
                              {form.minAge === "0" ? "All ages" : `${form.minAge}+`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!isFreeEvent(form.waves) && (
                <div className="bg-dark rounded-xl p-5 sm:p-6">
                  <h3 className="font-headline text-xs font-medium uppercase tracking-widest text-light mb-2">Refund &amp; Transfer Policy</h3>
                  {describeTiers(form.refundTiers).map((line, i) => (
                    <p key={i} className="text-sm font-medium text-light leading-relaxed">{line}</p>
                  ))}
                  {form.refundPolicy.trim() && (
                    <p className="text-sm font-medium text-muted leading-relaxed mt-2">{form.refundPolicy}</p>
                  )}
                </div>
                )}
              </div>

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN WIZARD PAGE
   Shared event create/edit wizard used by both the organiser portal
   (/organiser/new-listing) and the admin portal (/admin/events/...).
   ══════════════════════════════════════════════════════════════ */
