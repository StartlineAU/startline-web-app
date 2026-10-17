"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { X, CheckCircle, AlertCircle, Star, Flag, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import SignInModal from "@/components/SignInModal";
import SelectMenu from "@/components/ui/SelectMenu";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useAuthContext } from "@/context/AuthContext";
import {
  REVIEW_REPORT_DETAILS_MAX,
  REVIEW_REPORT_REASONS,
  topRatedEventsFromReviews,
  type ReviewReportReason,
} from "@/lib/review-helpers";
import { Skeleton } from "@/components/ui/skeleton";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  reviewerName: string;
  eventId?: string | null;
  eventTitle?: string | null;
  overallRating: number;
  atmosphereRating?: number | null;
  organisationRating?: number | null;
  experienceRating?: number | null;
  title: string;
  body: string;
  isVerified: boolean;
  createdAt: string;
}

export type ReviewEventOption = {
  id: string;
  title: string;
  eventDate: string;
};

// ─── Star helpers ─────────────────────────────────────────────────────────────

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.min(1, Math.max(0, rating - (i - 1)));
        return (
          <span key={i} className={cn("relative inline-block", sz)}>
            <Star className={cn(sz, "text-dark-lighter")} />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn(sz, "text-primary fill-primary")} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function InteractiveStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110"
          aria-label={`${i} stars`}
        >
          <Star
            className={cn(
              "w-7 h-7 transition-colors",
              i <= (hover || value) ? "text-primary fill-primary" : "text-dark-lighter"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ r, onEdit, onReport, reported }: {
  r: Review;
  /** Set only on the viewer's own review, which can be edited but not reported. */
  onEdit?: () => void;
  onReport: () => void;
  reported: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = r.body.length > 200;
  const body = expanded || !isLong ? r.body : r.body.slice(0, 200) + "…";

  const subMetrics = [
    { label: "Atmosphere", value: r.atmosphereRating },
    { label: "Organisation", value: r.organisationRating },
    { label: "Experience", value: r.experienceRating },
  ].filter((m): m is { label: string; value: number } => typeof m.value === "number" && m.value > 0);

  const eventLabel = r.eventTitle?.trim();

  return (
    <div data-review-id={r.id} className="bg-dark border border-dark-lighter rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-dark-lighter border border-dark-lighter flex items-center justify-center font-headline text-[14px] font-black text-light shrink-0">
            {r.reviewerName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline text-[13px] font-bold text-light">{r.reviewerName}</span>
              {r.isVerified && (
                <span className="inline-flex items-center gap-1 text-[9px] font-headline font-bold uppercase tracking-widest text-primary">
                  <CheckCircle className="w-2.5 h-2.5" /> Verified attendee
                </span>
              )}
            </div>
            {eventLabel && (
              r.eventId ? (
                <Link
                  href={`/events/${r.eventId}`}
                  className="mt-0.5 inline-block font-headline text-[12px] font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors line-clamp-1"
                >
                  {eventLabel}
                </Link>
              ) : (
                <div className="mt-0.5 font-headline text-[12px] font-medium uppercase tracking-widest text-muted line-clamp-1">
                  {eventLabel}
                </div>
              )
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1.5">
            <Stars rating={r.overallRating} size="sm" />
            <span className="font-headline text-[13px] font-bold text-light tabular-nums">
              {r.overallRating.toFixed(1)}
            </span>
          </div>
          <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-1">
            {timeAgo(r.createdAt)}
          </div>
        </div>
      </div>

      <div>
        <div className="font-headline text-[15px] font-bold text-light mb-1">{r.title}</div>
        <p className="text-[13px] text-muted leading-relaxed">{body}</p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-headline font-bold uppercase tracking-widest text-primary mt-1 hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {subMetrics.length > 0 && (
        <div className="pt-4 border-t border-dark-lighter grid grid-cols-1 sm:grid-cols-3 gap-4">
          {subMetrics.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <div className="font-headline text-[12px] font-medium text-light mb-1.5">
                {label}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Stars rating={value} size="sm" />
                <span className="font-headline text-[13px] font-bold text-light tabular-nums">
                  {value.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-dark-lighter">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-[11px] font-headline font-bold uppercase tracking-widest text-primary hover:underline"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
        {onEdit ? null : reported ? (
          <span className="text-[11px] font-headline font-bold uppercase tracking-widest text-primary">Reported</span>
        ) : (
          <button
            type="button"
            onClick={onReport}
            className="inline-flex items-center gap-1.5 text-[11px] font-headline font-bold uppercase tracking-widest text-muted hover:text-red-400 transition-colors"
          >
            <Flag className="w-3 h-3" /> Report
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Write review modal ───────────────────────────────────────────────────────

interface ModalProps {
  organiserId: string;
  events: ReviewEventOption[];
  onClose: () => void;
  onSuccess: (r: Review) => void;
  /** When set, the modal edits this existing review (PATCH) instead of creating. */
  editReview?: Review | null;
}

function WriteReviewModal({ organiserId, events, onClose, onSuccess, editReview }: ModalProps) {
  const editing = Boolean(editReview);
  const [overall,  setOverall]  = useState(editReview?.overallRating ?? 0);
  const [comms,    setComms]    = useState(editReview?.atmosphereRating ?? 0);
  const [org,      setOrg]      = useState(editReview?.organisationRating ?? 0);
  const [exp,      setExp]      = useState(editReview?.experienceRating ?? 0);
  const [title,    setTitle]    = useState(editReview?.title ?? "");
  const [body,     setBody]     = useState(editReview?.body ?? "");
  const [eventId,  setEventId]  = useState(editReview?.eventId ?? "");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);

  const submit = async () => {
    if (!overall) { setError("Please select an overall rating."); return; }
    if (!title.trim()) { setError("Please add a review title."); return; }
    if (!body.trim()) { setError("Please write your review."); return; }

    setSaving(true); setError("");
    try {
      const payload = {
        overallRating: overall,
        atmosphereRating: comms || null,
        organisationRating: org || null,
        experienceRating: exp || null,
        title,
        body,
        eventId: eventId || null,
        turnstileToken: turnstileToken ?? undefined,
      };
      const url = editing
        ? `/api/public/review/${editReview!.id}`
        : `/api/public/reviews/${organiserId}`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Sign in to write a review.");
        return;
      }
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }

      setDone(true);
      const newReview: Review = {
        id: data.id ?? editReview?.id ?? crypto.randomUUID(),
        reviewerName: data.reviewerName ?? editReview?.reviewerName ?? "Startline user",
        eventId: data.eventId ?? (eventId || null),
        eventTitle: data.eventTitle ?? events.find((e) => e.id === eventId)?.title ?? null,
        overallRating: overall,
        atmosphereRating: comms || null,
        organisationRating: org || null,
        experienceRating: exp || null,
        title,
        body,
        isVerified: editReview?.isVerified ?? false,
        createdAt: editReview?.createdAt ?? new Date().toISOString(),
      };
      setTimeout(() => { onSuccess(newReview); onClose(); }, 1800);
    } catch {
      setError("Could not submit. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-dark-darker/80 backdrop-blur-sm overlay-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-dark border border-dark-lighter rounded-2xl flex flex-col modal-in max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-dark-lighter">
            <div>
              <h2 className="font-headline text-xl font-black italic tracking-tighter text-light">
                {editing ? "Edit Review" : "Write a Review"}
              </h2>
              <p className="text-[12px] text-muted mt-0.5">Share your experience at this organiser&apos;s events.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded hover:bg-dark-lighter text-muted hover:text-primary flex items-center justify-center transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {done ? (
            <div className="px-6 py-12 text-center">
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
              <div className="font-headline text-xl font-black italic text-light mb-1">Review submitted!</div>
              <div className="text-[13px] text-muted">Thanks for sharing your experience.</div>
            </div>
          ) : (
            <div className="px-6 py-6 space-y-5">

              {/* Overall rating */}
              <div>
                <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-light mb-2">
                  Overall rating <span className="text-primary">*</span>
                </div>
                <InteractiveStars value={overall} onChange={setOverall} />
              </div>

              {/* Sub-ratings */}
              <div className="grid grid-cols-3 gap-4">
                {([
                  { label: "Atmosphere", value: comms, onChange: setComms },
                  { label: "Organisation",  value: org,   onChange: setOrg   },
                  { label: "Experience",    value: exp,   onChange: setExp   },
                ] as const).map(({ label, value, onChange }) => (
                  <div key={label}>
                    <div className="font-headline text-[10px] uppercase tracking-widest text-muted mb-1.5">{label}</div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${label} ${i}`}>
                          <Star
                            className={cn(
                              "w-4 h-4 transition-colors",
                              i <= value ? "text-primary fill-primary" : "text-dark-lighter hover:text-primary/50"
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Event attended */}
              <div>
                <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-light mb-1.5">
                  Event attended <span className="text-muted-dark font-normal">(optional)</span>
                </div>
                <SelectMenu
                  size="sm"
                  value={eventId}
                  onChange={setEventId}
                  placeholder="Select an event…"
                  ariaLabel="Event attended"
                  options={events.map((e) => ({ value: e.id, label: e.title }))}
                />
              </div>

              {/* Title */}
              <div>
                <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-light mb-1.5">
                  Review title <span className="text-primary">*</span>
                </div>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Summarise your experience…"
                  maxLength={100}
                  className="w-full bg-dark-darker border border-dark-lighter rounded-md px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
                    Your review <span className="text-primary">*</span>
                  </div>
                  <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{body.length}/800</span>
                </div>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  maxLength={800}
                  rows={4}
                  placeholder="What was the event like? How was the organisation, communication, and overall experience?"
                  className="w-full bg-dark-darker border border-dark-lighter rounded-md px-3 py-2.5 text-[13px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors resize-none"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-red-400 text-[12px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {TURNSTILE_SITE_KEY && (
                <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setTurnstileToken} />
              )}

              <div className="flex items-center gap-3 pt-2">
                <button onClick={onClose} className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light px-4 py-2.5 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={saving}
                  className="flex-1 bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50"
                >
                  {saving ? "Submitting…" : editing ? "Save changes" : "Submit review"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Report review modal ──────────────────────────────────────────────────────

function ReportReviewModal({ review, onClose, onReported }: {
  review: Review;
  onClose: () => void;
  onReported: (reviewId: string) => void;
}) {
  const [reason, setReason] = useState<ReviewReportReason | "">("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!reason) { setError("Choose a reason for the report."); return; }
    if (reason === "Other" && !details.trim()) { setError("Tell us what is wrong with this review."); return; }

    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/public/review/${review.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      // Already reported counts as done: the team has it either way.
      if (res.ok || res.status === 409) {
        setDone(true);
        onReported(review.id);
        return;
      }
      if (res.status === 401) { setError("Sign in to report a review."); return; }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not submit the report.");
    } catch {
      setError("Could not submit the report. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-dark-darker/80 backdrop-blur-sm overlay-in" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-review-title"
          className="pointer-events-auto w-full max-w-md bg-dark border border-dark-lighter rounded-2xl flex flex-col modal-in max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-dark-lighter">
            <div className="min-w-0">
              <h2 id="report-review-title" className="font-headline text-xl font-black italic tracking-tighter text-light">
                Report review
              </h2>
              <p className="text-[12px] text-muted mt-0.5 truncate">&ldquo;{review.title}&rdquo; by {review.reviewerName}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded hover:bg-dark-lighter text-muted hover:text-primary flex items-center justify-center transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {done ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
              <div className="font-headline text-xl font-black italic text-light mb-1">Report sent</div>
              <div className="text-[13px] text-muted mb-6">The Startline team will look at this review and remove it if it breaks the rules.</div>
              <button
                type="button"
                onClick={onClose}
                className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light px-4 py-2.5 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="px-6 py-6 space-y-5">
              <fieldset>
                <legend className="font-headline text-[11px] font-bold uppercase tracking-widest text-light mb-2">
                  Why are you reporting this review? <span className="text-primary">*</span>
                </legend>
                <div className="space-y-2">
                  {REVIEW_REPORT_REASONS.map((option) => (
                    <label
                      key={option}
                      className={cn(
                        "flex items-center gap-3 border rounded-md px-3 py-2.5 cursor-pointer transition-colors",
                        reason === option ? "border-primary bg-primary/5" : "border-dark-lighter hover:border-primary/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={option}
                        checked={reason === option}
                        onChange={() => { setReason(option); setError(""); }}
                        className="accent-primary"
                      />
                      <span className="text-[13px] text-light">{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label htmlFor="report-details" className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
                    Details {reason === "Other"
                      ? <span className="text-primary">*</span>
                      : <span className="text-muted-dark font-normal">(optional)</span>}
                  </label>
                  <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                    {details.length}/{REVIEW_REPORT_DETAILS_MAX}
                  </span>
                </div>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={REVIEW_REPORT_DETAILS_MAX}
                  rows={3}
                  placeholder="Anything that helps the team understand the problem."
                  className="w-full bg-dark-darker border border-dark-lighter rounded-md px-3 py-2.5 text-[13px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors resize-none"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-red-400 text-[12px]" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button onClick={onClose} className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light px-4 py-2.5 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={saving}
                  className="flex-1 bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50"
                >
                  {saving ? "Sending…" : "Send report"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main reviews section ─────────────────────────────────────────────────────

interface Props {
  reviews: Review[];
  organiserId: string;
  events: ReviewEventOption[];
  loading: boolean;
  onNewReview: (r: Review) => void;
  /** Hide write-review CTAs (organiser portal twin). */
  readOnly?: boolean;
}

export default function ReviewsSection({
  reviews,
  organiserId,
  events,
  loading,
  onNewReview,
  readOnly = false,
}: Props) {
  const { status } = useAuthContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [editReview, setEditReview] = useState<Review | null>(null);
  const [ownReview, setOwnReview] = useState<Review | null>(null);
  const [reportTarget, setReportTarget] = useState<Review | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set());
  const [eventFilter, setEventFilter] = useState("");
  // What the signed-out visitor was doing when sign-in interrupted them.
  const [afterSignIn, setAfterSignIn] = useState<{ kind: "write" } | { kind: "report"; review: Review }>({ kind: "write" });

  // Fetch the current user's own review so the "Write a review" CTA becomes
  // "Edit" and their existing review shows an Edit button.
  useEffect(() => {
    if (readOnly || status !== "authenticated") return;
    let cancelled = false;
    fetch(`/api/public/reviews/${organiserId}/mine`)
      .then((res) => (res.ok ? res.json() : { review: null }))
      .then((data) => {
        if (!cancelled && data.review) setOwnReview(data.review as Review);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [organiserId, status, readOnly]);

  function openWriteReview() {
    if (readOnly) return;
    if (status !== "authenticated") {
      setAfterSignIn({ kind: "write" });
      setSignInOpen(true);
      return;
    }
    setEditReview(ownReview);
    setModalOpen(true);
  }

  function openReport(r: Review) {
    if (status !== "authenticated") {
      setAfterSignIn({ kind: "report", review: r });
      setSignInOpen(true);
      return;
    }
    setReportTarget(r);
  }

  const handleReported = useCallback((id: string) => {
    setReportedIds((prev) => new Set(prev).add(id));
  }, []);

  const handleSuccess = useCallback((r: Review) => {
    setOwnReview(r);
    setEditReview(null);
    onNewReview(r);
  }, [onNewReview]);

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length
    : 0;

  function avgSub(
    pick: (r: Review) => number | null | undefined
  ): { value: number; count: number } | null {
    const vals = reviews.map(pick).filter((v): v is number => typeof v === "number" && v > 0);
    if (!vals.length) return null;
    return {
      value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
      count: vals.length,
    };
  }

  const metrics = [
    { label: "Atmosphere", data: avgSub((r) => r.atmosphereRating) },
    { label: "Organisation", data: avgSub((r) => r.organisationRating) },
    { label: "Experience", data: avgSub((r) => r.experienceRating) },
  ].filter((m): m is { label: string; data: { value: number; count: number } } => m.data != null);

  const topEvents = topRatedEventsFromReviews(reviews, 3);

  // Filter by event: keyed on title so reviews of a since-deleted event (eventId
  // nulled, title kept) still group together.
  const eventFilterOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reviews) {
      const t = r.eventTitle?.trim();
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, count]) => ({ value: title, label: `${title} (${count})` }));
  }, [reviews]);
  const activeEventFilter = eventFilterOptions.some((o) => o.value === eventFilter) ? eventFilter : "";
  const visibleReviews = activeEventFilter
    ? reviews.filter((r) => r.eventTitle?.trim() === activeEventFilter)
    : reviews;

  return (
    <div id="reviews">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-headline text-2xl font-black italic tracking-tighter text-light">
            Reviews
            {reviews.length > 0 && (
              <span className="ml-3 font-headline text-[14px] font-normal not-italic text-muted">({reviews.length})</span>
            )}
          </h2>
          {avgRating > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Stars rating={avgRating} size="sm" />
              <span className="font-headline text-[13px] font-bold text-light">{avgRating.toFixed(1)}</span>
              <span className="font-headline text-[11px] text-muted">out of 5</span>
            </div>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openWriteReview}
            className="flex items-center gap-2 border border-dark-lighter hover:border-primary/60 text-muted hover:text-light font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md transition-colors"
          >
            {ownReview ? "Edit your review" : "Write a review"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-4 space-y-4" role="status" aria-label="Loading reviews">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border border-dark-lighter rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-dark-lighter rounded-xl">
          <div className="flex items-center justify-center gap-0.5 mb-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-6 h-6 text-dark-lighter" />
            ))}
          </div>
          <div className="font-headline text-[15px] font-black italic text-light mb-1">No reviews yet</div>
          <div className={`text-[13px] text-muted ${readOnly ? "" : "mb-5"}`}>
            {readOnly
              ? "Reviews from participants will appear here."
              : "Be the first to share your experience with this organiser."}
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={openWriteReview}
              className="inline-flex items-center gap-2 bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
            >
              Write the first review
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-[minmax(140px,auto)_1fr] gap-6 bg-dark border border-dark-lighter rounded-xl p-6">
            <div className="flex flex-col items-center justify-center text-center sm:pr-6 sm:border-r sm:border-dark-lighter">
              <div className="font-headline text-[52px] font-black italic leading-none text-light">{avgRating.toFixed(1)}</div>
              <div className="mt-2">
                <Stars rating={avgRating} size="md" />
              </div>
              <div className="font-headline text-[11px] text-muted mt-2">
                <span className="font-bold text-light">{reviews.length}</span>
                {" "}
                {reviews.length === 1 ? "rating in total" : "ratings in total"}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-6 min-w-0 w-full">
              {metrics.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 w-full">
                  {metrics.map(({ label, data }) => (
                    <div key={label} className="min-w-0">
                      <div className="font-headline text-[14px] font-medium text-light mb-2">{label}</div>
                      <div className="h-2.5 bg-dark-lighter rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(data.value / 5) * 100}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="font-headline text-[14px] font-bold text-light tabular-nums">
                          {data.value.toFixed(1)}
                        </span>
                        <span className="text-[12px] text-muted">
                          ({data.count} {data.count === 1 ? "rating" : "ratings"})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-headline text-xs text-muted">No category ratings yet.</p>
              )}

              {topEvents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 w-full pt-5 border-t border-dark-lighter">
                  {topEvents.map((ev) => {
                    const titleNode = ev.eventId ? (
                      <Link
                        href={`/events/${ev.eventId}`}
                        className="font-headline text-[14px] font-medium text-light hover:text-primary transition-colors line-clamp-2"
                      >
                        {ev.eventTitle}
                      </Link>
                    ) : (
                      <div className="font-headline text-[14px] font-medium text-light line-clamp-2">{ev.eventTitle}</div>
                    );
                    return (
                      <div key={`${ev.eventId ?? ev.eventTitle}`} className="min-w-0">
                        <div className="mb-2">{titleNode}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Stars rating={ev.average} size="sm" />
                          <span className="font-headline text-[14px] font-bold text-light tabular-nums">
                            {ev.average.toFixed(1)}
                          </span>
                          <span className="text-[12px] text-muted">
                            ({ev.count} {ev.count === 1 ? "rating" : "ratings"})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {eventFilterOptions.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                {activeEventFilter
                  ? `Showing ${visibleReviews.length} of ${reviews.length} reviews`
                  : `Showing all ${reviews.length} reviews`}
              </div>
              <div className="w-full sm:w-72">
                <SelectMenu
                  size="sm"
                  value={activeEventFilter}
                  onChange={setEventFilter}
                  ariaLabel="Filter reviews by event"
                  options={[{ value: "", label: "All events" }, ...eventFilterOptions]}
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {visibleReviews.map((r) => (
              <ReviewCard
                key={r.id}
                r={r}
                onEdit={!readOnly && ownReview?.id === r.id ? () => { setEditReview(r); setModalOpen(true); } : undefined}
                onReport={() => openReport(r)}
                reported={reportedIds.has(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {!readOnly && modalOpen && (
        <WriteReviewModal
          organiserId={organiserId}
          events={events}
          editReview={editReview}
          onClose={() => { setModalOpen(false); setEditReview(null); }}
          onSuccess={handleSuccess}
        />
      )}

      {reportTarget && (
        <ReportReviewModal
          review={reportTarget}
          onClose={() => setReportTarget(null)}
          onReported={handleReported}
        />
      )}

      {!readOnly && (
        <SignInModal
          isOpen={signInOpen}
          onClose={() => setSignInOpen(false)}
          onSuccess={() => {
            setSignInOpen(false);
            if (afterSignIn.kind === "report") {
              setReportTarget(afterSignIn.review);
              return;
            }
            // Re-fetch own review after sign-in (it may not be loaded yet).
            fetch(`/api/public/reviews/${organiserId}/mine`)
              .then((res) => (res.ok ? res.json() : { review: null }))
              .then((data) => { setOwnReview(data.review as Review | null); })
              .catch(() => {});
            setEditReview(ownReview);
            setModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
