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
import AddressAutocomplete  from "@/components/ui/AddressAutocomplete";
import SuburbAutocomplete   from "@/components/ui/SuburbAutocomplete";
import LocationPreviewMap   from "@/components/organiser/LocationPreviewMap";
import DatePicker           from "@/components/ui/DatePicker";
import SelectMenu           from "@/components/ui/SelectMenu";
import TimePicker           from "@/components/ui/TimePicker";
import AddOnEditor, {
  uploadAddOnImages,
  publishAddOnsToProfile,
  PublishToProfileError,
} from "@/components/organiser/AddOnEditor";
import {
  type AddOnDraft,
  draftsFromCatalogue,
  draftsToPayload,
  draftValidationError,
} from "@/lib/add-on-drafts";


import {
  STEPS, STEP_ERRORS, INITIAL, Field, RichTextEditor, fmt24to12,
  inputCls, textareaCls, DISCIPLINES, DISCIPLINE_CATS, FORMATS,
  INTENSITY_LEVELS, stripHtml,
  type FormState, type Wave, type InfoPdf, type Discipline, type Format,
  type Intensity, type AusState,
} from "./event-form/shared";
import {
  BasicsStep, WhenStep, TicketsStep, MediaStep, ReviewStep,
  waveIsComplete, SESSION_EXPIRED_MESSAGE,
} from "./event-form/steps";
import { LivePreview, EventFullPreview } from "./event-form/previews";

/* ═══════════════════════════════════════════════════════════════
   MAIN WIZARD PAGE
   Shared event create/edit wizard used by both the organiser portal
   (/organiser/new-listing) and the admin portal (/admin/events/...).
   ══════════════════════════════════════════════════════════════ */
interface EventFormWizardProps {
  apiBase: string;             // "/api/organiser" | "/api/admin"
  submitRedirect: string;      // where to go after save
  cancelRedirect: string;      // where to go on cancel/discard
  eventId?: string;            // explicit edit id (admin path param); falls back to ?id=
  organiserId?: string;        // admin create — the organiser to create the event for
  requireOrganiser?: boolean;  // admin create — block submit until an organiser is selected
  headingLabel?: string;       // breadcrumb label, default "Create new listing"
  organiserHasAbn?: boolean;   // false shows a non-blocking "profile incomplete" notice
}

export default function EventFormWizard({
  apiBase,
  submitRedirect,
  cancelRedirect,
  eventId: eventIdProp,
  organiserId,
  requireOrganiser = false,
  headingLabel = "Create new listing",
  organiserHasAbn = true,
}: EventFormWizardProps) {
  const router = useRouter();
  const [step,            setStep]            = useState(0);
  const [form,            setForm]            = useState<FormState>(INITIAL);
  const [loadingEvent,    setLoadingEvent]    = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [apiError,        setApiError]        = useState("");
  const [submitErrors,    setSubmitErrors]    = useState<number[]>([]);
  const [visited,         setVisited]         = useState<Set<number>>(new Set());
  const [confirmed,       setConfirmed]       = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [abnNotice,       setAbnNotice]       = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [direction,       setDirection]       = useState<"forward" | "back">("forward");
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [eventId,         setEventId]         = useState<string | null>(null);
  // The add-on catalogue is loaded and saved through its own route, not the
  // event payload, because it must stay editable after the event is approved.
  const [addOns,          setAddOns]          = useState<AddOnDraft[]>([]);
  const showAddOns = apiBase === "/api/organiser";
  const originalFields = useRef<Record<string, unknown>>({});

  const update = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    const id = eventIdProp ?? new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    fetch(`${apiBase}/events/${id}`)
      .then(r => r.json())
      .then(e => {
        if (e.error) return;
        setEventId(id);
        originalFields.current = { inclusions: e.inclusions, activations: e.activations, accessibilityInfo: e.accessibilityInfo };
        setForm({
          title:             e.title          ?? "",
          discipline:        e.discipline     ?? "",
          description:       e.description    ?? "",
          format:            e.format         ?? "",
          level:             e.level          ?? "",
          categories:        Array.isArray(e.categories) ? e.categories : [],
          cap:               e.cap != null && e.cap > 0 ? String(e.cap) : "0",
          minAge:            e.minAge != null ? String(e.minAge) : "",
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
          waves:             Array.isArray(e.waves) && e.waves.length
            ? e.waves.map((w: Wave) => ({ label: w.label ?? "", price: w.price ?? "", closes: w.closes ?? "", startTime: w.startTime ?? "" }))
            : [{ label: "", price: "", closes: "", startTime: "" }],
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
      .catch(() => {})
      .finally(() => setLoadingEvent(false));

    if (apiBase === "/api/organiser") {
      fetch(`${apiBase}/events/${id}/add-ons`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.addOns)) setAddOns(draftsFromCatalogue(data.addOns));
        })
        .catch(() => {});
    }
  }, [apiBase, eventIdProp]);

  const stepHasErrors = (s: number): boolean => {
    if (s === 0) {
      const hasCatRequirement = !!DISCIPLINE_CATS[form.discipline as Discipline];
      return !(
        form.title.trim().length > 2 &&
        form.format &&
        form.discipline &&
        form.level &&
        form.cap !== "" &&
        form.minAge !== "" &&
        (!hasCatRequirement || form.categories.length > 0)
      );
    }
    if (s === 1) return !(form.date && form.startTime && form.address.trim() && form.city.trim() && form.state) ||
      !!(form.startTime && form.endTime && form.endTime <= form.startTime);
    if (s === 2) return !(
      form.waves.length > 0 &&
      // Every category, not just the first. Each one carries the same required
      // stars, and a second category left half-filled used to pass this check.
      form.waves.every(waveIsComplete) &&
      (form.registrationType === "startline" || !!form.registrationUrl.trim()) &&
      tiersAreValid(form.refundTiers)
    );
    if (s === 3) return !((form.coverImage || form.coverImageUrl) && stripHtml(form.description).length > 0);
    if (s === 4) return !confirmed;
    return false;
  };

  const goTo = (target: number) => {
    setVisited(prev => new Set([...prev, step]));
    setDirection(target > step ? "forward" : "back");
    if (target !== STEPS.length - 1) setConfirmed(false);
    setStep(target);
  };

  // Distinguishes an expired session from a rejected file, and passes the
  // upload's specific reason through instead of a blanket "failed to upload".
  const uploadErrorText = (err: unknown, fallback: string): string => {
    if (err instanceof UploadError && err.status === 401) return SESSION_EXPIRED_MESSAGE;
    const reason = err instanceof Error ? err.message : "";
    return reason ? `${fallback} ${reason}` : `${fallback} Please try again or remove it.`;
  };

  const submitToApi = async (asDraft: boolean, overrideTitle?: string): Promise<boolean> => {
    setSaving(true); setApiError(""); setSubmitErrors([]);
    try {
      if (requireOrganiser && !organiserId) {
        setApiError("Select an organiser to create this event for.");
        return false;
      }

      // Checked before anything is uploaded or written, so a bad catalogue
      // cannot leave the event saved and the merchandise silently dropped.
      if (showAddOns) {
        const addOnError = draftValidationError(addOns);
        if (addOnError) { setApiError(addOnError); return false; }
      }

      // Cognito access tokens last 60 minutes and nothing refreshes them after
      // page load, so a wizard session longer than that used to 401 right here
      // at the end (issue #300). fetchAuthSession refreshes an expired token
      // from the refresh token and rewrites the cookies the API verifies.
      // Failure is fine: the e2e bypass has no Cognito session at all, so let
      // the requests themselves decide.
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
        cap:               form.cap && parseInt(form.cap) > 0 ? parseInt(form.cap) : null,
        minAge:            form.minAge ? parseInt(form.minAge) : null,
        waves:             form.waves,
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

      // Add-ons go to their own route, and only once the event has an id: a
      // brand new event does not exist until the call above returns one. Saved
      // before the ABN notice below so the catalogue lands either way.
      const savedEventId = eventId ?? data.id;
      if (showAddOns && savedEventId) {
        try {
          const withImages = await uploadAddOnImages(addOns);
          setAddOns(withImages);
          // Before the catalogue save, so the profile links are saved with it.
          const published = await publishAddOnsToProfile(withImages);
          setAddOns(published);
          const addOnRes = await fetch(`${apiBase}/events/${savedEventId}/add-ons`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addOns: draftsToPayload(published) }),
          });
          if (!addOnRes.ok) {
            const addOnData = await addOnRes.json().catch(() => ({}));
            // The event itself saved. Say so, so the organiser does not redo it.
            // The route's own message already covers an expired session, and
            // SESSION_EXPIRED_MESSAGE would be wrong here: it says nothing was
            // saved, and by this point the event has been.
            setApiError(
              (addOnData.error ?? "Could not save your merchandise.") +
                " Your event details were saved.",
            );
            return false;
          }
        } catch (err) {
          // Keep the profile items already published, so a retry does not
          // publish them a second time.
          if (err instanceof PublishToProfileError) setAddOns(err.drafts);
          // UploadError and PublishToProfileError already name the product and
          // the reason. Anything else is a dropped connection, where the
          // browser's own text says nothing useful to an organiser.
          setApiError(
            (err instanceof UploadError || err instanceof PublishToProfileError
              ? err.message
              : "Could not save your merchandise.") + " Your event details were saved.",
          );
          return false;
        }
      }

      // The event is saved. Hold the redirect so the organiser is told what the
      // missing ABN cost them, rather than being refused before anything saved.
      if (!asDraft && data.abnRequired) {
        setAbnNotice(data.notice ?? "");
        return true;
      }
      router.push(submitRedirect);
      return true;
    } catch {
      setApiError("Something went wrong. Please check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) { goTo(step + 1); }
    else {
      const errs = Array.from({ length: STEPS.length }, (_, i) => i).filter(i => stepHasErrors(i));
      if (errs.length > 0) { setVisited(new Set(Array.from({ length: STEPS.length }, (_, i) => i))); setSubmitErrors(errs); return; }
      submitToApi(false);
    }
  };
  const prev = () => {
    if (step > 0) { setVisited(s => new Set([...s, step])); setDirection("back"); setStep(step - 1); }
    else { setShowCancelModal(true); }
  };

  const STEP_HEADINGS = [
    { h: <>Let&apos;s start with <span className="text-primary">the basics.</span></>, sub: "The essentials every athlete sees first." },
    { h: <>When and where <span className="text-primary">do athletes race?</span></>, sub: "Athletes search by city, state and date." },
    { h: <>Tickets, pricing <span className="text-primary">and registration.</span></>, sub: "Add ticket categories, pricing and per-category wave start times." },
    { h: <>Images and <span className="text-primary">event description.</span></>, sub: "Upload your cover image and write the event description." },
    { h: <>Review, then <span className="text-primary">hit publish.</span></>, sub: "Nothing is live yet. You can edit anytime after publishing." },
  ];

  return (
    <div className="min-h-screen bg-dark-darker pt-14">
      <div className="anim-fade-slide">

          {/* Sticky header */}
          <div className="sticky top-14 z-30 bg-dark/95 backdrop-blur border-b border-dark-lighter">
            <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-3 pb-3">
              {/* Breadcrumb */}
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-1.5 text-light hover:text-primary font-headline text-[11px] uppercase tracking-widest transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Event Listings
                </button>
                <span className="font-headline text-light">/</span>
                <span className="font-headline text-[11px] uppercase tracking-widest text-light">{headingLabel}</span>
                <div className="ml-auto flex items-center gap-3">
                  <button onClick={() => setShowFullPreview(true)}
                    className="flex items-center gap-1.5 font-headline text-[11px] font-bold uppercase tracking-widest text-light hover:text-primary transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                </div>
              </div>

              {/* Step rail */}
              <div className="flex items-center gap-0 overflow-x-auto no-scrollbar -mx-2 px-2">
                {STEPS.map((s, i) => {
                  const done   = visited.has(i) && !stepHasErrors(i) && i !== step;
                  const cur    = i === step;
                  const hasErr = visited.has(i) && stepHasErrors(i) && !cur;
                  return (
                    <div key={s.k} className="flex items-center flex-1 min-w-0">
                      <button onClick={() => goTo(i)}
                        className={`flex items-center gap-2.5 text-left transition-opacity min-w-0 ${cur ? "opacity-100" : "opacity-70 hover:opacity-100"}`}>
                        <div className={`relative w-8 h-8 rounded-md border flex items-center justify-center font-headline font-black italic text-[13px] flex-shrink-0
                          ${cur ? "bg-primary text-dark border-primary" : hasErr ? "bg-orange-400/10 text-orange-400 border-orange-400/40" : done ? "bg-dark-light text-primary border-primary/40" : "bg-dark border-dark-lighter text-light"}`}>
                          {hasErr ? <span className="text-[15px] leading-none font-black">!</span> : done ? <Check className="w-4 h-4" /> : s.n}
                        </div>
                        <div className="hidden xl:block min-w-0">
                          <div className={`font-headline text-[11px] font-bold uppercase tracking-widest truncate ${cur ? "text-light" : hasErr ? "text-orange-500" : "text-light"}`}>
                            {s.label}
                          </div>
                          <div className={`font-headline text-[10px] uppercase tracking-widest truncate ${hasErr ? "text-orange-400" : "text-light"}`}>
                            {hasErr ? "Missing required fields" : s.sub}
                          </div>
                        </div>
                      </button>
                      {i < STEPS.length - 1 && <div className="flex-1 h-px mx-3 bg-dark-lighter" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="max-w-[1280px] mx-auto grid lg:grid-cols-[1fr_360px]">
            <div className="p-4 sm:p-6 lg:p-8 pt-8 sm:pt-10 lg:pt-12 pb-32 lg:pb-10">
              <div key={step} className={direction === "forward" ? "step-forward" : "step-back"}>
                <div className="mb-6">
                  <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
                    STEP {STEPS[step].n} / {STEPS[STEPS.length - 1].n}
                  </div>
                  <h1 className="font-headline text-[28px] sm:text-[38px] font-black italic tracking-tighter leading-tight text-light">
                    {STEP_HEADINGS[step].h}
                  </h1>
                  <p className="font-headline text-light mt-3 max-w-2xl text-[14px]">{STEP_HEADINGS[step].sub}</p>
                </div>

                {step === 0 && <BasicsStep  form={form} update={update} />}
                {step === 1 && <WhenStep    form={form} update={update} />}
                {step === 2 && (
                  <TicketsStep
                    form={form}
                    update={update}
                    addOns={addOns}
                    setAddOns={setAddOns}
                    showAddOns={showAddOns}
                  />
                )}
                {step === 3 && <MediaStep   key={loadingEvent ? "loading" : (eventId ?? "new")} form={form} update={update} />}
                {step === 4 && <ReviewStep  form={form} setStep={goTo} confirmed={confirmed} onConfirm={setConfirmed} showAbnNotice={!organiserHasAbn && form.registrationType === "startline"} />}

                {apiError && (
                  <div className="mt-4 px-4 py-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-300 font-headline text-[13px]">
                    {apiError}
                  </div>
                )}

                {submitErrors.length > 0 && (
                  <div className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                    <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[11px] font-black">!</span>
                      Before you can submit, please complete the following:
                    </p>
                    <ul className="space-y-2.5">
                      {submitErrors.map(i => (
                        <li key={i} className="flex items-start justify-between gap-4 py-2.5 px-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                          <div>
                            <p className="font-headline text-[12px] font-bold uppercase tracking-widest text-orange-600">{STEPS[i].n} — {STEPS[i].label}</p>
                            <p className="font-headline text-orange-500 text-[12px] mt-0.5">{STEP_ERRORS[i]}</p>
                          </div>
                          <button onClick={() => { setSubmitErrors([]); goTo(i); }}
                            className="shrink-0 font-headline text-[11px] font-bold uppercase tracking-widest text-orange-500 hover:text-orange-700 flex items-center gap-1 transition-colors mt-0.5">
                            Fix now <ArrowRight className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Mobile preview toggle */}
              <div className="lg:hidden mt-8 rounded-xl border border-dark-lighter overflow-hidden">
                <button type="button" onClick={() => setShowMobilePreview(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-dark-light text-left">
                  <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Event preview</span>
                  <ChevronDown className={`w-4 h-4 text-light transition-transform duration-200 ${showMobilePreview ? "rotate-180" : ""}`} />
                </button>
                {showMobilePreview && (
                  <div className="p-5 pt-0 bg-dark-light border-t border-dark-lighter"><LivePreview form={form} /></div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between pt-5 border-t border-dark-lighter">
                <button onClick={prev}
                  className="font-headline text-[13px] font-bold uppercase tracking-widest text-light hover:text-light flex items-center gap-2 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Cancel" : "Back"}
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => submitToApi(true, form.title.trim() || "Untitled draft")} disabled={saving}
                    className="font-headline text-[13px] font-bold uppercase tracking-widest text-light hover:text-light px-5 py-3 transition-colors disabled:opacity-40">
                    Save draft
                  </button>
                  <button onClick={next} disabled={saving || (step === STEPS.length - 1 && !confirmed)}
                    className="bg-machined shadow-machined disabled:opacity-40 disabled:cursor-not-allowed text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform">
                    {saving
                      ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Saving…</>
                      : step === STEPS.length - 1
                        ? <><Check className="w-4 h-4" /> Publish listing</>
                        : <>Continue <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            </div>

            {/* Live preview sidebar */}
            <aside className="hidden lg:block border-l border-dark-lighter bg-dark p-6 sticky top-[152px] h-[calc(100dvh-152px)] overflow-y-auto">
              <LivePreview form={form} />
            </aside>
          </div>
      </div>

      {showFullPreview && <EventFullPreview form={form} onClose={() => setShowFullPreview(false)} />}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
          <div className="relative bg-dark border border-dark-lighter rounded-2xl shadow-2xl w-full max-w-sm p-7 modal-in">
            <h2 className="font-headline text-[22px] font-black italic tracking-tight text-light mb-2">Leave without saving?</h2>
            <p className="font-headline text-light text-[14px] leading-relaxed mb-7">
              Your event details haven&apos;t been saved yet. Save as a draft so you can come back and finish it later.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={async () => { await submitToApi(true, form.title.trim() || "Untitled draft"); setShowCancelModal(false); }}
                disabled={saving}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? "Saving…" : <><Check className="w-4 h-4" /> Save draft &amp; leave</>}
              </button>
              <button onClick={() => router.push(cancelRedirect)}
                className="w-full font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md border border-dark-lighter text-light hover:text-light hover:border-primary/40 transition-colors">
                Discard &amp; leave
              </button>
              <button onClick={() => setShowCancelModal(false)}
                className="font-headline text-[12px] uppercase tracking-widest text-light hover:text-light transition-colors text-center py-1">
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
