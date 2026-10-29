"use client";

import { useState } from "react";
import { Check, UserRound } from "lucide-react";

/** Fields a registration can add to the buyer's profile (PUT /api/user/profile). */
export interface ProfileUpdate {
  name?: string;
  mobile?: string;
  dateOfBirth?: string;
  gender?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

function rows(update: ProfileUpdate): [string, string][] {
  const out: [string, string][] = [];
  if (update.name) out.push(["Name", update.name]);
  if (update.mobile) out.push(["Mobile", update.mobile]);
  if (update.dateOfBirth) out.push(["Date of birth", update.dateOfBirth]);
  if (update.gender) out.push(["Gender", update.gender]);
  const contact = [update.emergencyContactName, update.emergencyContactPhone].filter(Boolean).join(" · ");
  if (contact) out.push(["Emergency contact", contact]);
  return out;
}

/** Shown on the confirmation screen when the buyer typed details their
    profile doesn't have yet. Nothing is saved unless they say so. */
export default function SaveDetailsPrompt({ update }: { update: ProfileUpdate }) {
  const [state, setState] = useState<"ask" | "saving" | "saved" | "error" | "dismissed">("ask");

  if (state === "dismissed") return null;

  const save = async () => {
    setState("saving");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "saved") {
    return (
      <div className="flex items-center gap-3 bg-primary/[0.07] border border-primary/30 rounded-[14px] px-5 py-4 mb-6 text-left">
        <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={2.5} />
        <span className="text-[13px] text-light">Saved. Your details will fill in automatically next time.</span>
      </div>
    );
  }

  return (
    <div className="bg-dark-light border border-dark-lighter rounded-[14px] px-[22px] py-5 mb-6 text-left">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <UserRound className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="font-headline text-[12px] font-bold uppercase tracking-[0.13em] text-light">
            Faster checkout next time?
          </div>
          <p className="text-[13px] text-muted mt-1 leading-relaxed">
            Save these details to your account and we&apos;ll fill them in for your next registration.
          </p>
        </div>
      </div>

      <div className="mb-4">
        {rows(update).map(([label, value]) => (
          <div key={label} className="flex justify-between items-baseline gap-4 py-2 border-b border-white/[0.06] last:border-b-0">
            <span className="text-[12.5px] text-muted shrink-0">{label}</span>
            <span className="text-[12.5px] text-light text-right truncate">{value}</span>
          </div>
        ))}
      </div>

      {state === "error" && (
        <p className="text-[12px] text-red-300 mb-3">Couldn&apos;t save your details. Try again, or add them later in Settings.</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setState("dismissed")}
          className="h-10 px-4 rounded-xl font-headline text-[11px] font-bold uppercase tracking-[0.12em] text-muted hover:bg-dark hover:text-light transition-colors"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="h-10 px-4 rounded-xl bg-primary text-dark font-headline text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : "Save to my account"}
        </button>
      </div>
    </div>
  );
}
