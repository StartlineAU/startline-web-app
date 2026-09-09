"use client";

import { cn } from "@/lib/utils";

export function RegisterField({
  label,
  required,
  error,
  fieldKey,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  fieldKey?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-invalid={error ? fieldKey : undefined}>
      <label
        htmlFor={htmlFor}
        className={cn(
          "flex items-center gap-1 font-headline text-[10.5px] font-bold uppercase tracking-[0.15em] mb-2",
          error ? "text-red-400" : "text-muted"
        )}
      >
        {label}
        {required && <span className="text-primary">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 font-headline text-[11px] font-medium text-red-400">{error}</p>
      )}
    </div>
  );
}

/** Shared input styling for the registration form, matching the design tokens. */
export const registerInputCls = (hasError?: boolean) =>
  cn(
    "w-full bg-dark-light border rounded-[10px] px-[13px] py-[11px] text-[13.5px] font-headline text-light placeholder:text-placeholder focus:outline-none transition-colors",
    hasError ? "border-red-500/70 focus:border-red-500" : "border-dark-lighter focus:border-primary"
  );
