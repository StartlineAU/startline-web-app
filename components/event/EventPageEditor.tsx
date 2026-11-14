"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Circle, X } from "lucide-react";
import EventDetailView from "@/components/event/EventDetailView";
import { encodePrizePool, parsePrizePool } from "@/lib/prize-pool";
import { uploadFile, UploadError } from "@/lib/upload-client";
import { parseTiers } from "@/lib/refund-policy";
import { isFreeEvent } from "@/lib/event-types";
import { takesPayments } from "@/lib/event-approval";
import { customerHref } from "@/lib/portal-domains";
import { usePortalHost } from "@/lib/use-portal-host";
import { safeReturnPath } from "@/lib/safe-return-path";
import {
  DISCIPLINE_CATS, EMPTY_WAVE, INITIAL, eventCap, requirementChecks, waveQty,
  type Discipline, type FormState, type RegionId, type Wave,
} from "./event-form/shared";
import { popIn, revealWords, spotlight, staggerIn } from "./event-form/motion";
import { formToDetailData } from "./event-form/to-detail";
import { InfoTip } from "./event-form/info-tip";
import {
  BannerMeta, CoverControls, CoverMedia, DescriptionEditor, DetailsEditor, DisciplinePill,
  GalleryEditor, InformationEditor, PrizePoolEditor, RefundCard, RegistrationEditor,
  ReviewsPlaceholder, TicketsEditor, TitleInput, useObjectUrls,
} from "./event-form/regions";

// Shown when an upload or the event save comes back 401. submitToApi refreshes
// the token first, so landing here means the refresh token itself is gone.
const SESSION_EXPIRED_MESSAGE =
  "Your session has expired and nothing was saved. Please sign in again, then retry. Keep this tab open so you don't lose your event details.";

/** Rows of the Event Details card, in order. Each opens in place rather than all at once. */
const DETAIL_ROWS: RegionId[] = ["date", "time", "location", "format", "divisions", "intensity"];
const DETAIL_LABELS: Partial<Record<RegionId, string>> = {
  date: "Date", time: "Time", location: "Location", format: "Format",
  divisions: "Divisions", intensity: "Intensity",
};
/**
 * Rows that one answer finishes move on by themselves once it is given (#528).
 * The rest wait for Next: divisions take several picks, and time and location
 * are complete before their optional fields (cut-off time, venue name) are
 * reached, so moving on would cut those off.
 */
const AUTO_ADVANCE = new Set<RegionId>(["date", "format", "intensity"]);
/** A picker or suggestion list still open inside a row: the organiser is mid-choice. */
const OPEN_PICKER = '[aria-haspopup][aria-expanded="true"], [role="combobox"][aria-expanded="true"]';

interface EditContext {
  /** Confirmed entrants a material change would email. */
  enteredCount: number;
  /** Published event owned by an unverified organiser: a save waits for review. */
  needsReview?: boolean;
  pendingRevision?: {
    lines: { label: string; from: string; to: string }[];
    payload: Record<string, unknown>;
  } | null;
}

/** Where the Edit link came from (?from=), so saving returns there. Same-site
 *  paths only, so the parameter can never send anyone off the site. */
function returnPath(): string | null {
  if (typeof window === "undefined") return null;
  const from = new URLSearchParams(window.location.search).get("from");
  if (!from) return null;
  const safe = safeReturnPath(from, { fallback: "" });
  return safe || null;
}

interface EventPageEditorProps {
  apiBase: string;             // "/api/organiser" | "/api/admin"
  submitRedirect: string;      // where to go after save
  cancelRedirect: string;      // where to go on cancel/discard
  eventId?: string;            // explicit edit id (admin path param); falls back to ?id=
  organiserId?: string;        // admin create — the organiser to create the event for
  requireOrganiser?: boolean;  // admin create — block submit until an organiser is selected
  headingLabel?: string;       // breadcrumb label, default "Create new listing"
  organiserHasAbn?: boolean;   // false shows a non-blocking "profile incomplete" notice
}

/**
 * Create or edit a listing on the listing itself (issue #528). The organiser
 * fills in the athlete event page, rendered by the same `EventDetailView` the
 * public page uses, with each region swapped for its control, so the form is
 * its own preview. What is still required is a checklist that takes them to
 * the region, rather than a step rail, and the terms are agreed in a dialog
 * that Publish opens.
 *
 * Used by the organiser portal (/organiser/new-listing) and the admin portal
 * (/admin/events/create, /admin/events/[id]/edit).
 */
export default function EventPageEditor({
  apiBase,
  submitRedirect,
  cancelRedirect,
  eventId: eventIdProp,
  organiserId,
  requireOrganiser = false,
  headingLabel = "Create new listing",
  organiserHasAbn = true,
}: EventPageEditorProps) {
  const router = useRouter();
  const termsHref = customerHref("/terms#organisers", usePortalHost());
  const [form,            setForm]            = useState<FormState>(INITIAL);
  const [showConfirm,     setShowConfirm]     = useState(false);
  // A short note after Publish with fields still empty. Cleared on a timer.
  const [toast,           setToast]           = useState<string | null>(null);
  const [openRow,         setOpenRow]         = useState<RegionId | null>(null);
  // Unfinished regions are only outlined once the organiser asks what is left
  // or tries to publish, so an empty page does not open covered in warnings.
  const [revealMissing,   setRevealMissing]   = useState(false);
  const [showChecklist,   setShowChecklist]   = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [apiError,        setApiError]        = useState("");
  const [confirmed,       setConfirmed]       = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  // Where the leave prompt sends the organiser when it was opened by a link
  // out of the editor rather than by Cancel. Null means the usual redirects.
  const [leaveTo,         setLeaveTo]         = useState<string | null>(null);
  const [abnNotice,       setAbnNotice]       = useState<string | null>(null);
  const [eventId,         setEventId]         = useState<string | null>(null);
  // Edit mode: the status the event had when it loaded, and how many paid
  // entrants a date/time/location/type change would email.
  const [eventStatus,     setEventStatus]     = useState<string | null>(null);
  const [editContext,     setEditContext]     = useState<EditContext | null>(null);
  const [loadError,       setLoadError]       = useState("");
  const originalFields = useRef<Record<string, unknown>>({});
  const checklistRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);

  const isLive = eventStatus === "APPROVED" || eventStatus === "IN_PROGRESS";
  const isEditingPublished = !!eventId && eventStatus !== null && eventStatus !== "DRAFT";
  const awaitsReview = isLive && editContext?.needsReview === true;
  const saveLabel = awaitsReview ? "Submit for review" : "Save changes";
  const finalLabel = awaitsReview ? "Submit for review" : isLive ? "Save changes" : eventStatus === "REJECTED" ? "Resubmit" : eventStatus === "PENDING" ? "Save & keep in review" : "Publish listing";

  const update = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));
  const { coverSrc, photoSrcs } = useObjectUrls(form.coverImage, form.coverImageUrl, form.photos);

  useEffect(() => {
    const id = eventIdProp ?? new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    fetch(`${apiBase}/events/${id}`)
      .then(async r => ({ ok: r.ok, e: await r.json().catch(() => ({})) }))
      .then(({ ok, e }) => {
        // Failing silently here left an empty form that, saved, would have
        // created a second event instead of editing this one.
        if (!ok || e.error) {
          setLoadError(e.error ?? "This event could not be loaded. Go back and try again.");
          return;
        }
        setEventId(id);
        setEventStatus(typeof e.status === "string" ? e.status : null);
        setEditContext(e.editContext ?? null);
        // The form edits the queued revision, not the live row, so a later save
        // does not drop changes that are still waiting for review.
        if (e.editContext?.pendingRevision?.payload) Object.assign(e, e.editContext.pendingRevision.payload);
        originalFields.current = { inclusions: e.inclusions, activations: e.activations, accessibilityInfo: e.accessibilityInfo };
        const waves: Wave[] = Array.isArray(e.waves) && e.waves.length
          ? e.waves.map((w: { label?: string; price?: string; closes?: string; startTime?: string; qty?: number }) => ({
              label: w.label ?? "", price: w.price ?? "", closes: w.closes ?? "", startTime: w.startTime ?? "",
              qty: typeof w.qty === "number" && w.qty > 0 ? String(w.qty) : "",
            }))
          : [EMPTY_WAVE];
        // An overall cap from before ticket quantities. One ticket category
        // takes it as its own quantity; with several it stays an overall limit,
        // shown under Pricing where the organiser can remove it.
        let legacyCap = e.cap != null && e.cap > 0 && !waves.every(w => waveQty(w) !== null) ? String(e.cap) : "";
        if (legacyCap && waves.length === 1) { waves[0] = { ...waves[0], qty: legacyCap }; legacyCap = ""; }
        setForm({
          title:             e.title          ?? "",
          discipline:        e.discipline     ?? "",
          description:       e.description    ?? "",
          format:            e.format         ?? "",
          level:             e.level          ?? "",
          categories:        Array.isArray(e.categories) ? e.categories : [],
          cap:               legacyCap,
          date:              e.eventDate      ?? "",
          endDate:           e.endDate        ?? "",
          startTime:         e.startTime      ?? "",
          endTime:           e.endTime        ?? "",
          venue:             e.venue          ?? "",
          address:           e.address        ?? "",
          city:              e.city           ?? "",
          state:             e.state          ?? "",
          latitude:          e.latitude       ?? null,
          longitude:         e.longitude      ?? null,
          waves,
          prizeMoney:        !!parsePrizePool(e.extras),
          prizeMoneyAmount:  parsePrizePool(e.extras)?.amount ?? "",
          prizeMoneyDetails: parsePrizePool(e.extras)?.details ?? "",
          refundTiers:       parseTiers(e.refundTiers),
          refundPolicy:      e.refundPolicy   ?? "",
          registrationType:  e.registrationType === "external" ? "external" : "startline",
          feeStructure:      e.feeStructure   === "organiser"  ? "organiser" : "athlete",
          registrationUrl:   e.registrationUrl   ?? "",
          coverImage:        null,
          coverImageUrl:     e.coverImageUrl  ?? "",
          informationPdfs:   Array.isArray(e.informationPdfs)
            ? e.informationPdfs.map((p: { url: string; label?: string | null; name?: string | null }) => ({
                file: null, url: p.url ?? "", label: p.label ?? "", name: p.name ?? "",
              }))
            : [],
          photos:            [],
          photoUrls:         Array.isArray(e.photos) ? e.photos.filter((p: unknown): p is string => typeof p === "string") : [],
        });
      })
      .catch(() => setLoadError("This event could not be loaded. Check your connection and try again."));
  }, [apiBase, eventIdProp]);

  const checks = requirementChecks(form);
  const missing = checks.filter(c => !c.done);
  const doneCount = checks.length - missing.length;
  const missingFor = (region: RegionId) =>
    revealMissing ? missing.find(m => m.region === region)?.message : undefined;
  /** Take the organiser to a region: its row open, scrolled to, focused. */
  const goToRegion = useCallback((region: RegionId, { reveal = true }: { reveal?: boolean } = {}) => {
    setShowChecklist(false);
    if (reveal) setRevealMissing(true);
    if (DETAIL_ROWS.includes(region)) setOpenRow(region);
    // After the row has opened.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`region-${region}`);
      if (!el) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "center" });
      const field = el.querySelector<HTMLElement>("input:not([type=file]):not([type=checkbox]), textarea, [contenteditable]");
      field?.focus({ preventScroll: true });
      // The banner's cover region is the whole photo; ringing it says nothing.
      if (region !== "cover") spotlight((el.firstElementChild as HTMLElement | null) ?? el);
    }));
  }, []);

  /* ── Moving through the details card ── */
  const showsDivisions = !!DISCIPLINE_CATS[form.discipline as Discipline] || form.categories.length > 0;
  const rows = DETAIL_ROWS.filter(r => r !== "divisions" || showsDivisions);
  // A row with no check (divisions on a discipline that has none) counts as done.
  const rowDone = (r: RegionId) => checks.find(c => c.region === r)?.done ?? true;
  const nextRowAfter = (id: RegionId): RegionId | null => {
    const i = rows.indexOf(id);
    return [...rows.slice(i + 1), ...rows.slice(0, i)].find(r => !rowDone(r)) ?? null;
  };
  const advanceFrom = (id: RegionId) => {
    const next = nextRowAfter(id);
    if (next) goToRegion(next, { reveal: false });
    else setOpenRow(null);
  };
  const advanceRef = useRef(advanceFrom);
  useEffect(() => { advanceRef.current = advanceFrom; });

  // When the open row is finished, open the next unfinished one. It waits
  // while a picker in the row is still open (a date range's end, a suggestion
  // list) or a number is being typed, so it never cuts a choice short.
  const openRowDone = openRow ? rowDone(openRow) : false;
  const lastOpen = useRef<{ row: RegionId | null; done: boolean }>({ row: null, done: false });
  useEffect(() => {
    const prev = lastOpen.current;
    lastOpen.current = { row: openRow, done: openRowDone };
    if (!openRow || !AUTO_ADVANCE.has(openRow)) return;
    if (prev.row !== openRow || prev.done || !openRowDone) return;

    const row = openRow;
    let timer = 0;
    const attempt = (tries: number) => {
      timer = window.setTimeout(() => {
        const el = document.getElementById(`region-${row}`);
        const active = document.activeElement as HTMLInputElement | null;
        const busy = !!el?.querySelector(OPEN_PICKER) || (!!active && el?.contains(active) === true && active.type === "number");
        if (busy) { if (tries < 40) attempt(tries + 1); return; }
        advanceRef.current(row);
      }, tries === 0 ? 650 : 300);
    };
    attempt(0);
    return () => window.clearTimeout(timer);
  }, [openRow, openRowDone]);

  useEffect(() => { if (showChecklist && checklistRef.current) staggerIn(checklistRef.current.querySelectorAll("li")); }, [showChecklist]);
  useEffect(() => { if (toast) popIn(toastRef.current); }, [toast]);
  const dialogTitle = eventStatus === "REJECTED" ? "Resubmit for review?" : eventStatus === "PENDING" ? "Save and keep in review?" : "Publish your listing?";
  useEffect(() => {
    if (!showConfirm) return;
    popIn(dialogRef.current);
    return revealWords(dialogTitleRef.current, dialogTitle);
  }, [showConfirm, dialogTitle]);
  const isReady = missing.length === 0;
  useEffect(() => { if (isReady) popIn(chipRef.current, 0.85); }, [isReady]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!showChecklist) return;
    const onDown = (e: MouseEvent) => {
      if (checklistRef.current && !checklistRef.current.contains(e.target as Node)) setShowChecklist(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showChecklist]);

  // Distinguishes an expired session from a rejected file, and passes the
  // upload's specific reason through instead of a blanket "failed to upload".
  const uploadErrorText = (err: unknown, fallback: string): string => {
    if (err instanceof UploadError && err.status === 401) return SESSION_EXPIRED_MESSAGE;
    const reason = err instanceof Error ? err.message : "";
    return reason ? `${fallback} ${reason}` : `${fallback} Please try again or remove it.`;
  };

  const submitToApi = async (asDraft: boolean, overrideTitle?: string, redirectTo?: string): Promise<boolean> => {
    setSaving(true); setApiError("");
    try {
      if (requireOrganiser && !organiserId) {
        setApiError("Select an organiser to create this event for.");
        return false;
      }

      // Cognito access tokens last 60 minutes and nothing refreshes them after
      // page load, so a long editing session used to 401 right here at the end
      // (issue #300). fetchAuthSession refreshes an expired token from the
      // refresh token and rewrites the cookies the API verifies. Failure is
      // fine: the e2e bypass has no Cognito session at all, so let the
      // requests themselves decide.
      await fetchAuthSession().catch(() => null);

      let coverImageUrl: string | null = null;
      if (form.coverImage) {
        try {
          coverImageUrl = await uploadFile(form.coverImage, "cover");
        } catch (err) {
          setApiError(uploadErrorText(err, "Cover image upload failed.")); return false;
        }
      }

      const informationPdfs: { url: string; label: string; name: string }[] = [];
      for (const pdf of form.informationPdfs) {
        let url = pdf.url;
        if (pdf.file) {
          try {
            url = await uploadFile(pdf.file, "document");
          } catch (err) {
            setApiError(uploadErrorText(err, `PDF "${pdf.file.name}" failed to upload.`)); return false;
          }
        }
        if (url) informationPdfs.push({ url, label: pdf.label.trim(), name: pdf.name });
      }

      const photoUrls: string[] = [...form.photoUrls];
      for (const photo of form.photos) {
        try {
          photoUrls.push(await uploadFile(photo, "photo"));
        } catch (err) {
          setApiError(uploadErrorText(err, `Gallery photo "${photo.name}" failed to upload.`)); return false;
        }
      }

      const payload = {
        title:             overrideTitle ?? form.title,
        discipline:        form.discipline,
        description:       form.description,
        eventDate:         form.date,
        endDate:           form.endDate || null,
        startTime:         form.startTime,
        endTime:           form.endTime,
        venue:             form.venue,
        address:           form.address,
        city:              form.city,
        state:             form.state,
        latitude:          form.latitude,
        longitude:         form.longitude,
        format:            form.format,
        level:             form.level,
        categories:        form.categories,
        // The total of the ticket quantities, which every capacity check reads.
        cap:               eventCap(form),
        // A quantity is only stored when the organiser set one: no `qty` is
        // what checkout already reads as "no limit".
        waves:             form.waves.map(({ qty, ...w }) => {
          const n = waveQty({ qty });
          return n === null ? w : { ...w, qty: n };
        }),
        inclusions:        originalFields.current.inclusions ?? null,
        activations:       originalFields.current.activations ?? null,
        extras:            form.prizeMoney ? encodePrizePool(form.prizeMoneyAmount, form.prizeMoneyDetails) : (originalFields.current.extras ?? null),
        refundTiers:       isFreeEvent(form.waves) ? [] : form.refundTiers,
        refundPolicy:      form.refundPolicy,
        registrationType:  form.registrationType,
        feeStructure:      form.feeStructure,
        registrationUrl:   form.registrationType === "external" ? form.registrationUrl : null,
        accessibilityInfo: originalFields.current.accessibilityInfo ?? null,
        submit:            !asDraft,
        coverImageUrl:     coverImageUrl ?? form.coverImageUrl ?? null,
        informationPdfs,
        photos:            photoUrls,
        ...(!eventId && organiserId ? { organiserId } : {}),
      };

      return await sendPayload(payload, asDraft, redirectTo);
    } catch {
      setApiError("Something went wrong. Please check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const sendPayload = async (payload: Record<string, unknown>, asDraft: boolean, redirectTo?: string): Promise<boolean> => {
    let res: Response;
    if (eventId) {
      res = await fetch(`${apiBase}/events/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      res = await fetch(`${apiBase}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setApiError(res.status === 401 ? SESSION_EXPIRED_MESSAGE : (data.error ?? "Something went wrong."));
      return false;
    }
    if (asDraft && !eventId && data.id) setEventId(data.id);
    // The event is saved. Hold the redirect so the organiser is told what the
    // missing ABN cost them, rather than being refused before anything saved.
    if (!asDraft && data.abnRequired) {
      setAbnNotice(data.notice ?? "");
      return true;
    }
    router.push(redirectTo ?? returnPath() ?? submitRedirect);
    return true;
  };

  // A link out of the editor goes through the same prompt as Cancel, so
  // following it cannot silently throw away an unsaved event.
  const askToLeave = (destination: string) => { setLeaveTo(destination); setShowCancelModal(true); };
  const closeLeavePrompt = () => { setShowCancelModal(false); setLeaveTo(null); };

  const saveDraft = () => submitToApi(true, form.title.trim() || "Untitled draft");
  // A live event saves its changes and stays live: the organiser agreed to
  // the terms when it was first published. Anything else with items still
  // missing opens the checklist; a finished listing asks for the terms.
  const publish = () => {
    if (isLive) { void submitToApi(true, form.title.trim() || "Untitled draft"); return; }
    if (missing.length > 0) {
      // Straight to the first gap, with a quiet count of the rest, rather than
      // a list dropped over the page.
      goToRegion(missing[0].region);
      setToast(missing.length === 1
        ? "One required field left. We've taken you to it."
        : `${missing.length} required fields left. We've taken you to the first.`);
      return;
    }
    setConfirmed(false);
    setShowConfirm(true);
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-dark-darker pt-14">
        <main className="max-w-[720px] mx-auto px-6 py-12">
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-6 flex items-start gap-3" role="alert">
            <AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
            <div>
              <h1 className="font-headline text-[18px] font-black italic tracking-tight text-light">Couldn&apos;t open this event</h1>
              <p className="text-[13px] text-muted-light mt-1">{loadError}</p>
              <button onClick={() => router.push(returnPath() ?? cancelRedirect)}
                className="mt-4 inline-flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest border border-dark-lighter text-light hover:border-primary hover:text-primary px-3.5 py-2 rounded-full transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Go back
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const data = formToDetailData(form, { cover: coverSrc, photos: photoSrcs });
  const remaining = missing.length;
  const progress = checks.length ? doneCount / checks.length : 1;
  const showAbnNotice = !organiserHasAbn && takesPayments(form.registrationType, form.waves);

  const secondaryButton = !isLive && (
    <button type="button" onClick={saveDraft} disabled={saving}
      className="font-headline text-[12px] sm:text-[13px] font-bold uppercase tracking-widest text-light hover:text-primary px-3 sm:px-4 py-3 transition-colors disabled:opacity-40 whitespace-nowrap">
      {isEditingPublished ? "Save changes" : "Save draft"}
    </button>
  );
  const primaryButton = (
    <button type="button" onClick={publish} disabled={saving}
      title={!isLive && missing.length ? `${missing.length} required item${missing.length === 1 ? "" : "s"} left` : undefined}
      className="bg-machined shadow-machined disabled:opacity-40 disabled:cursor-not-allowed text-dark font-headline text-[12px] sm:text-[13px] font-bold uppercase tracking-widest px-4 sm:px-6 py-3 sm:py-3.5 rounded-md flex items-center gap-2 whitespace-nowrap hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform">
      {saving
        ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Saving…</>
        : <><Check className="w-4 h-4" /> {isLive ? saveLabel : finalLabel}</>}
    </button>
  );

  return (
    <div className="min-h-screen bg-dark-darker pt-14 pb-24 lg:pb-0">

      {/* ── Sticky header: where you are, what is left, and the save actions ── */}
      <div className="sticky top-14 z-30 bg-dark/95 backdrop-blur border-b border-dark-lighter" data-testid="editor-header">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 sm:gap-4">
          <button onClick={() => setShowCancelModal(true)}
            className="flex items-center gap-1.5 text-light hover:text-primary font-headline text-[11px] uppercase tracking-widest transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Event Listings</span>
          </button>
          <span className="hidden sm:inline font-headline text-light">/</span>
          <span className="hidden md:inline font-headline text-[11px] uppercase tracking-widest text-light truncate">
            {eventId && headingLabel === "Create new listing" ? "Edit listing" : headingLabel}
          </span>

          {/* Checklist */}
          <div ref={checklistRef} className="relative ml-auto sm:ml-2">
            <button ref={chipRef} type="button" onClick={() => setShowChecklist(v => !v)}
              aria-expanded={showChecklist} aria-haspopup="true" data-testid="checklist-toggle"
              aria-label={remaining === 0 ? "Ready to publish. Show checklist" : `${doneCount} of ${checks.length} required fields done. Show checklist`}
              className={`inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 font-headline text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-colors ${
                remaining === 0
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-dark-lighter text-light hover:border-light/40"
              }`}>
              {remaining === 0 ? (
                <><Check className="w-3.5 h-3.5" /> Ready to {isLive ? "save" : "publish"}</>
              ) : (
                <>
                  <span className="hidden sm:inline text-muted">Required</span>
                  <span className="tabular-nums">{doneCount}/{checks.length}</span>
                  <span className="w-12 sm:w-16 h-1 rounded-full bg-dark-lighter overflow-hidden" aria-hidden="true">
                    <span className="block h-full bg-primary rounded-full transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
                  </span>
                </>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showChecklist ? "rotate-180" : ""}`} />
            </button>

            {showChecklist && (
              <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-[7.25rem] sm:top-full sm:mt-2 sm:w-[340px] max-h-[60vh] overflow-y-auto rounded-xl border border-dark-lighter bg-dark shadow-2xl p-2 z-40" data-testid="checklist">
                <div className="flex items-baseline justify-between px-3 pt-2 pb-2.5 border-b border-white/5 mb-1">
                  <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">Required to publish</span>
                  <span className="font-headline text-[10px] uppercase tracking-widest text-muted">
                    {remaining === 0 ? "All done" : `${remaining} left`}
                  </span>
                </div>
                <ul>
                  {checks.map(c => (
                    <li key={c.region}>
                      <button type="button" onClick={() => goToRegion(c.region, { reveal: false })} title={c.done ? undefined : c.message} data-done={c.done}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5 transition-colors group">
                        {c.done
                          ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          : <Circle className="w-4 h-4 text-muted-dark shrink-0" />}
                        <span className={`flex-1 min-w-0 font-headline text-[13px] ${c.done ? "text-muted" : "text-light"}`}>{c.row}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:text-primary transition-opacity shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-1 shrink-0 ml-auto">
            {secondaryButton}
            {primaryButton}
          </div>
        </div>

        {apiError && (
          <div className="border-t border-red-400/20 bg-red-400/10" role="alert">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-start gap-2 font-headline text-[13px] text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{apiError}</span>
              <button type="button" onClick={() => setApiError("")} aria-label="Dismiss" className="text-red-300 hover:text-light"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {(showAbnNotice || editContext?.pendingRevision || (isEditingPublished && (editContext?.enteredCount ?? 0) > 0)) && (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 space-y-3">
          {/* Deliberately advisory, not a block. Publishing still works; the
              event waits for review instead of going live, and the organiser
              is told again once the work is safely saved. */}
          {showAbnNotice && (
            <div data-testid="abn-notice" className="flex items-start gap-3 bg-amber-400/[0.08] border border-amber-400/20 rounded-xl p-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="font-headline text-[13px] text-amber-200 leading-relaxed">
                <span className="font-bold">Your organiser profile isn&apos;t finished.</span>{" "}
                You can publish this listing, but without an ABN it goes to Startline for review
                instead of straight to live. Add yours in{" "}
                <Link href="/organiser/payments" className="underline hover:text-amber-100"
                  onClick={(e) => { e.preventDefault(); askToLeave("/organiser/payments"); }}>Payments</Link>{" "}
                to publish immediately.
              </div>
            </div>
          )}
          {editContext?.pendingRevision && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4" data-testid="pending-revision-notice">
              <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-amber-300">Changes awaiting review</p>
              <p className="text-[13px] text-muted-light leading-relaxed mt-1">
                The live listing is unchanged. Saving again replaces what is waiting.
              </p>
            </div>
          )}
          {isEditingPublished && (editContext?.enteredCount ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 flex items-start gap-3" data-testid="change-notice">
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <p className="text-[13px] text-muted-light leading-relaxed">
                <span className="font-headline font-bold text-light">
                  {editContext!.enteredCount} athlete{editContext!.enteredCount === 1 ? " has" : "s have"} entered.
                </span>{" "}
                Changing the category, format, date, times or location emails each of them, and the change is
                kept in this event&apos;s history. Anyone who no longer wants to take part asks for a refund
                through Support, which you and Startline review.
                {awaitsReview && " The listing stays as it is until Startline approves the edit."}
              </p>
            </div>
          )}
        </div>
      )}

      <EventDetailView
          data={data}
          mode="edit"
          slots={{
            bannerMedia:   <CoverMedia src={coverSrc} />,
            bannerOverlay: <CoverControls form={form} update={update} missing={missingFor("cover")} />,
            discipline:    <DisciplinePill form={form} update={update} missing={missingFor("discipline")} />,
            title:         <TitleInput form={form} update={update} missing={missingFor("title")} />,
            meta:          <BannerMeta form={form} onOpen={id => goToRegion(id, { reveal: false })} />,
            topLink:       null,
            overviewInfo: (
              <InfoTip label="Event overview">
                What athletes read first. Cover the course, the atmosphere, the divisions and what to bring.
              </InfoTip>
            ),
            detailsInfo: (
              <InfoTip label="Event details">
                Tap a row to fill it in. Finishing one moves you on to the next unfinished row.
              </InfoTip>
            ),
            overview:      <DescriptionEditor form={form} update={update} missing={missingFor("description")} />,
            prizePool:     <PrizePoolEditor form={form} update={update} />,
            pricing:       <TicketsEditor form={form} update={update} missing={missingFor("tickets")} />,
            gallery:       <GalleryEditor form={form} update={update} photoSrcs={photoSrcs} />,
            reviews:       <ReviewsPlaceholder />,
            actions:       <RegistrationEditor form={form} update={update} missing={missingFor("registration")} />,
            details: (
              <DetailsEditor form={form} update={update} openRow={openRow} missingFor={missingFor}
                onToggle={id => setOpenRow(cur => (cur === id ? null : id))}
                onNext={advanceFrom}
                nextLabel={id => { const n = nextRowAfter(id); return n ? DETAIL_LABELS[n] ?? null : null; }} />
            ),
            information:   <InformationEditor form={form} update={update} />,
            refund:        <RefundCard form={form} missing={missingFor("refund")} />,
          }}
        />

      {/* ── Phone: the save actions live at the foot of the screen ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-darker/95 backdrop-blur border-t border-dark-lighter px-4 py-3 safe-area-bottom">
        <div className="flex items-center justify-end gap-2">
          {secondaryButton}
          {primaryButton}
        </div>
      </div>

      {toast && (
        <div ref={toastRef} role="status" data-testid="editor-toast"
          className="fixed z-50 left-4 right-4 sm:left-auto sm:right-6 bottom-24 lg:bottom-6 sm:max-w-md rounded-xl border border-dark-lighter bg-dark shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" aria-hidden="true" />
          <span className="font-headline text-[13px] text-light flex-1">{toast}</span>
          <button type="button" onClick={() => { setToast(null); setShowChecklist(true); }}
            className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline whitespace-nowrap">
            View all
          </button>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="text-muted hover:text-light">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title" data-testid="publish-dialog"
            className="relative bg-dark border border-dark-lighter rounded-2xl shadow-2xl w-full max-w-md p-7">
            {/* Filled by revealWords: React must not own its text. */}
            <h2 ref={dialogTitleRef} id="publish-dialog-title" className="font-headline text-[22px] font-black italic tracking-tight text-light mb-2" />
            <p className="font-headline text-light text-[14px] leading-relaxed mb-5">
              {eventStatus === "REJECTED"
                ? "Your event goes back to Startline for review."
                : "Athletes will be able to find your event in search and carousels, and you'll be notified each time someone registers. You can still edit it afterwards."}
            </p>
            <label className="flex items-start gap-3 cursor-pointer mb-6">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                className="accent-primary w-4 h-4 mt-1 cursor-pointer shrink-0" />
              <span className="font-headline text-[13px] text-light leading-relaxed">
                I confirm I have the right to run this event, that it has the insurance and permits it
                needs, and that these details are accurate. I agree to the organiser terms in the{" "}
                <a href={termsHref} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>.
              </span>
            </label>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={async () => { if (await submitToApi(false)) setShowConfirm(false); }}
                disabled={!confirmed || saving}
                className="w-full bg-machined shadow-machined disabled:opacity-40 disabled:cursor-not-allowed text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md flex items-center justify-center gap-2">
                {saving ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Saving…</> : <><Check className="w-4 h-4" /> {finalLabel}</>}
              </button>
              <button type="button" onClick={() => setShowConfirm(false)}
                className="font-headline text-[12px] uppercase tracking-widest text-light transition-colors text-center py-1">
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeLeavePrompt} />
          <div className="relative bg-dark border border-dark-lighter rounded-2xl shadow-2xl w-full max-w-sm p-7 modal-in">
            <h2 className="font-headline text-[22px] font-black italic tracking-tight text-light mb-2">Leave without saving?</h2>
            <p className="font-headline text-light text-[14px] leading-relaxed mb-7">
              {isEditingPublished
                ? "Your changes haven't been saved yet. Save them now, or leave and keep the event as it is."
                : "Your event details haven't been saved yet. Save as a draft so you can come back and finish it later."}
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={async () => { await submitToApi(true, form.title.trim() || "Untitled draft", leaveTo ?? undefined); closeLeavePrompt(); }}
                disabled={saving}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? "Saving…" : <><Check className="w-4 h-4" /> {isEditingPublished ? <>{saveLabel} &amp; leave</> : <>Save draft &amp; leave</>}</>}
              </button>
              <button onClick={() => router.push(leaveTo ?? returnPath() ?? cancelRedirect)}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-dark-lighter text-light hover:border-primary/40 transition-colors">
                Discard &amp; leave
              </button>
              <button onClick={closeLeavePrompt}
                className="font-headline text-[12px] uppercase tracking-widest text-light transition-colors text-center py-1">
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-submit. The listing is already saved by the time this shows, so
          this explains a consequence rather than refusing anything. */}
      {abnNotice !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-dark border border-dark-lighter rounded-2xl shadow-2xl w-full max-w-md p-7 modal-in">
            <div className="flex items-start gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-1 shrink-0" />
              <h2 className="font-headline text-[22px] font-black italic tracking-tight text-light">
                Event submitted, pending review
              </h2>
            </div>
            <p className="font-headline text-light text-[14px] leading-relaxed mb-2">
              Your event has been saved and submitted. It won&apos;t go live yet: your organiser
              profile has no ABN, which Startline needs before you can take payments.
            </p>
            <p className="font-headline text-muted text-[13px] leading-relaxed mb-7">
              Add your ABN and our team can approve the listing. Nothing you entered has been lost.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => router.push("/organiser/payments")}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" /> Add my ABN
              </button>
              <button onClick={() => { setAbnNotice(null); router.push(submitRedirect); }}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-dark-lighter text-light hover:border-primary/40 transition-colors">
                I&apos;ll do it later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
