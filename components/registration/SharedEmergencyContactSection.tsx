"use client";

import { cn } from "@/lib/utils";
import type { EmergencyContactErrors } from "@/lib/registration-form";

const inputCls = (hasError?: boolean) =>
  cn(
    "w-full bg-dark-light border rounded-md px-4 py-3 text-[15px] text-light placeholder:text-muted focus:outline-none transition-colors",
    hasError
      ? "border-red-500/70 focus:border-red-500"
      : "border-dark-border focus:border-primary"
  );

function RegisterField({
  label,
  error,
  fieldKey,
  children,
}: {
  label: string;
  error?: string;
  fieldKey?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-invalid={error ? fieldKey : undefined}>
      <label
        className={cn(
          "font-headline text-[11px] font-bold uppercase tracking-widest block mb-1",
          error ? "text-red-400" : "text-muted"
        )}
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 font-headline text-[11px] font-medium text-red-400">{error}</p>
      )}
    </div>
  );
}

interface SharedEmergencyContactSectionProps {
  name: string;
  phone: string;
  errors?: EmergencyContactErrors;
  onChange: (field: "name" | "phone", value: string) => void;
}

export default function SharedEmergencyContactSection({
  name,
  phone,
  errors = {},
  onChange,
}: SharedEmergencyContactSectionProps) {
  return (
    <div className="bg-dark rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary">
          Emergency contact
        </h2>
        <p className="mt-2 text-[12px] text-muted leading-relaxed">
          One emergency contact for the whole group. This must be someone other than any participant.
        </p>
      </div>

      <RegisterField
        label="Contact name *"
        error={errors.emergencyContactName}
        fieldKey="shared-emergencyContactName"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Jamie Rossi"
          className={inputCls(!!errors.emergencyContactName)}
        />
      </RegisterField>

      <RegisterField
        label="Contact number *"
        error={errors.emergencyContactPhone}
        fieldKey="shared-emergencyContactPhone"
      >
        <input
          type="tel"
          value={phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder="0400 000 001"
          className={inputCls(!!errors.emergencyContactPhone)}
        />
      </RegisterField>
    </div>
  );
}
