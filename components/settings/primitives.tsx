"use client";

import { Check, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/context/SettingsContext";

export const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors";

export const cardCls = "border border-dark-lighter rounded-xl p-4 sm:p-5 space-y-4";
export const outlineBtnCls = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-headline text-[11px] font-bold uppercase tracking-widest border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const labelCls = "font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light block mb-1.5";

export function FieldLabel({
  label, hint, htmlFor, required,
}: { label: string; hint?: string; htmlFor?: string; required?: boolean }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label htmlFor={htmlFor} className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted-light">
        {label}{required && <span className="text-primary font-black text-[14px] leading-none ml-0.5">*</span>}
      </label>
      {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>}
    </div>
  );
}

export function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4">{children}</div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="px-4 py-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-300 font-headline text-[12px] leading-snug">
      {children}
    </div>
  );
}

export function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="px-4 py-3 rounded-lg bg-primary/10 border border-primary/25 text-primary font-headline text-[12px] leading-snug flex items-center gap-2">
      <Check className="w-4 h-4 shrink-0" /> {children}
    </div>
  );
}

export function Switch({
  checked, onChange, disabled, labelledBy,
}: { checked: boolean; onChange: () => void; disabled?: boolean; labelledBy: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy}
      onClick={onChange} disabled={disabled}
      className={`relative w-9 h-5 rounded-full shrink-0 ring-1 ring-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${checked ? "bg-primary" : "bg-white/10"}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${checked ? "translate-x-4 bg-dark" : "bg-muted"}`} />
    </button>
  );
}

// The right-hand pane: a heading, a scrolling body and, for forms, a footer
// that stays put while the body scrolls.
export function SectionShell({
  title, description, children, footer,
}: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-slim px-5 sm:px-6 py-5">
        <h3 className="font-headline text-[22px] font-black italic tracking-tight text-white leading-none">{title}</h3>
        {description && <p className="text-[13px] text-muted leading-relaxed mt-2">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && (
        <div className="shrink-0 border-t border-dark-lighter px-5 sm:px-6 py-3.5 bg-dark">{footer}</div>
      )}
    </>
  );
}

export function SaveFooter({
  saving, saved, disabled, onSave,
}: { saving: boolean; saved: boolean; disabled?: boolean; onSave: () => void }) {
  const { close } = useSettings();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="font-headline text-[11px] uppercase tracking-widest min-h-[16px]" aria-live="polite">
        {saved && <span className="text-primary flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Saved</span>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={close}
          className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light px-4 py-2.5 rounded-md transition-colors">
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={saving || disabled}
          className={cn(
            "bg-machined shadow-machined text-dark font-headline text-[11px] font-bold uppercase tracking-widest py-2.5 px-5 rounded-md flex items-center gap-2 transition-all",
            "hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50",
          )}>
          {saving ? "Saving…" : (<><Check className="w-4 h-4" /> Save</>)}
        </button>
      </div>
    </div>
  );
}
