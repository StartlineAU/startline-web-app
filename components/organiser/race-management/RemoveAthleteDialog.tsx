"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import FormSelect from "@/components/ui/FormSelect";
import {
  noteRequired,
  refundOptional,
  REMOVAL_NOTE_MAX,
  REMOVAL_REASON_LABEL,
  REMOVAL_REASONS,
  type RemovalReasonValue,
} from "@/lib/removal-reasons";
import type { Registration } from "@/components/organiser/race-management/types";

const labelCls = "font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5";

export interface RemovalOutcome {
  refund: "FULL" | "NONE" | "NOT_PAID" | "REPLACED";
  refundCents: number;
  blocked: boolean;
  warning: string | null;
  replacedBy: string | null;
}

const EMPTY_REPLACEMENT = {
  firstName: "", lastName: "", email: "", dateOfBirth: "",
  mobile: "", emergencyContactName: "", emergencyContactPhone: "",
};

const REPLACEMENT_FIELDS = [
  ["firstName", "First name", "text"],
  ["lastName", "Last name", "text"],
  ["email", "Email", "email"],
  ["dateOfBirth", "Date of birth", "date"],
  ["mobile", "Mobile", "tel"],
  ["emergencyContactName", "Emergency contact name", "text"],
  ["emergencyContactPhone", "Emergency contact phone", "tel"],
] as const;

/**
 * Remove from event (#571): the reason, an optional note, the refund for a paid
 * entry and an optional block. Owners and managers both see it.
 */
export default function RemoveAthleteDialog({
  eventId,
  registration,
  onClose,
  onRemoved,
}: {
  eventId: string;
  registration: Registration | null;
  onClose: () => void;
  onRemoved: (registrationId: string, outcome: RemovalOutcome) => void;
}) {
  const [reason, setReason] = useState<RemovalReasonValue | "">("");
  const [note, setNote] = useState("");
  const [shareNote, setShareNote] = useState(false);
  const [keepFee, setKeepFee] = useState(false);
  const [block, setBlock] = useState(false);
  // Team members only: hand the place to someone else instead of emptying it.
  const [replace, setReplace] = useState(false);
  const [replacement, setReplacement] = useState(EMPTY_REPLACEMENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setReason("");
    setNote("");
    setShareNote(false);
    setKeepFee(false);
    setBlock(false);
    setReplace(false);
    setReplacement(EMPTY_REPLACEMENT);
    setError("");
  };
  const close = () => {
    reset();
    onClose();
  };

  // A place nobody has been named for yet has no one to replace.
  const canReplace = Boolean(registration?.team && !registration.detailsPending);
  const replacing = canReplace && replace;
  const paidCents = registration?.removalRefundCents ?? 0;
  // A handed-over place stays paid for, so there is no refund to choose.
  const paid = paidCents > 0 && !replacing;
  const canKeepFee = paid && reason !== "" && refundOptional(reason);
  const refund: "FULL" | "NONE" = canKeepFee && keepFee ? "NONE" : "FULL";
  const amount = `$${(paidCents / 100).toFixed(2)}`;

  const submit = async () => {
    if (!registration) return;
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    if (noteRequired(reason) && !note.trim()) {
      setError("Say why in the note when the reason is Other.");
      return;
    }
    if (replacing && REPLACEMENT_FIELDS.some(([field]) => !replacement[field].trim())) {
      setError("Fill in every detail for the replacement.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/organiser/events/${eventId}/registrations/${registration.id}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          ...(note.trim() ? { note: note.trim(), shareNote } : {}),
          refund,
          block,
          ...(replacing ? { replacement } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not remove this athlete.");
        return;
      }
      const outcome = json as RemovalOutcome;
      reset();
      onRemoved(registration.id, outcome);
    } catch {
      setError("Could not reach Startline. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!registration} onOpenChange={(open) => { if (!open) close(); }}>
      {/* The replacement's details make this taller than a laptop screen, and a
          centred dialog that overflows puts its buttons out of reach. */}
      <DialogContent data-testid="remove-athlete-dialog" className="max-h-[calc(100dvh-2rem)] overflow-y-auto">

        <DialogHeader>
          <DialogTitle>Remove {registration?.name} from event</DialogTitle>
          <DialogDescription>
            {replacing
              ? "They are emailed to say they were removed, and their place passes to the person below."
              : "Their place, bib and start wave are released and they are emailed to say they were removed."}
            {registration?.team ? " The rest of the team stays entered." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="remove-reason" className={labelCls}>Reason</label>
            <FormSelect
              id="remove-reason"
              value={reason}
              onChange={(v) => {
                setReason(v as RemovalReasonValue);
                if (!refundOptional(v as RemovalReasonValue)) setKeepFee(false);
              }}
              options={[
                { value: "", label: "Choose a reason" },
                ...REMOVAL_REASONS.map((r) => ({ value: r, label: REMOVAL_REASON_LABEL[r] })),
              ]}
            />
          </div>

          <div>
            <label htmlFor="remove-note" className={labelCls}>
              Note{reason && noteRequired(reason) ? "" : " (optional)"}
            </label>
            <textarea
              id="remove-note"
              value={note}
              maxLength={REMOVAL_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Kept on the record for your organisation."
              className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none resize-none"
            />
            <label className="mt-2 flex items-center gap-2 text-[13px] text-muted-light cursor-pointer">
              <input
                type="checkbox"
                checked={shareNote}
                onChange={(e) => setShareNote(e.target.checked)}
                disabled={!note.trim()}
                className="accent-[#B3E153]"
              />
              Include this note in the athlete&apos;s email
            </label>
          </div>

          {canReplace && (
            <div className="rounded-lg border border-dark-lighter p-3 space-y-2" data-testid="remove-place">
              <p className={labelCls}>Their place on team {registration?.team?.name}</p>
              <label className="flex items-center gap-2 text-[13px] text-light cursor-pointer">
                <input type="radio" name="remove-place" checked={!replace} onChange={() => setReplace(false)} className="accent-[#B3E153]" />
                Leave it empty
              </label>
              <label className="flex items-center gap-2 text-[13px] text-light cursor-pointer">
                <input type="radio" name="remove-place" checked={replace} onChange={() => setReplace(true)} className="accent-[#B3E153]" />
                Give it to someone else
              </label>
              {replace && (
                <div className="space-y-2 pt-1" data-testid="remove-replacement">
                  <p className="text-[12px] text-muted-dark">
                    The new member takes over this place, its payment and the team&apos;s bib and wave. The place is
                    still in use, so no refund is issued.
                  </p>
                  {REPLACEMENT_FIELDS.map(([field, label, type]) => (
                    <div key={field}>
                      <label htmlFor={`replace-${field}`} className={labelCls}>{label}</label>
                      <input
                        id={`replace-${field}`}
                        type={type}
                        value={replacement[field]}
                        onChange={(e) => setReplacement((prev) => ({ ...prev, [field]: e.target.value }))}
                        className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {paid && (
            <div className="rounded-lg border border-dark-lighter p-3" data-testid="remove-refund">
              <p className={labelCls}>Refund</p>
              {canKeepFee ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[13px] text-light cursor-pointer">
                    <input type="radio" name="remove-refund" checked={!keepFee} onChange={() => setKeepFee(false)} className="accent-[#B3E153]" />
                    Full refund ({amount})
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-light cursor-pointer">
                    <input type="radio" name="remove-refund" checked={keepFee} onChange={() => setKeepFee(true)} className="accent-[#B3E153]" />
                    No refund
                  </label>
                  <p className="text-[12px] text-muted-dark">
                    Only keep the fee if your event terms allow it for a code of conduct breach.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-light">
                  A full refund of {amount} goes back to the athlete straight away. They didn&apos;t choose to leave.
                </p>
              )}
            </div>
          )}

          <label className="flex items-start gap-2 text-[13px] text-light cursor-pointer">
            <input
              type="checkbox"
              checked={block}
              onChange={(e) => setBlock(e.target.checked)}
              className="accent-[#B3E153] mt-0.5"
            />
            <span>
              Also block from entering again
              <span className="block text-[12px] text-muted-dark">
                Covers every event your organisation runs. Lift it any time from Settings → Blocked athletes.
              </span>
            </span>
          </label>

          {error && <p className="text-[13px] text-red-300" role="alert">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? "Removing…" : replacing ? "Remove and replace" : "Remove from event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
