"use client";

import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  maxDateOfBirthForMinAge,
  type RegistrationFormData,
  type RegistrationFormErrors,
  type RegistrationFormField,
} from "@/lib/registration-form";

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

interface ParticipantFormSectionProps {
  index: number;
  title: string;
  eventTitle: string;
  participant: RegistrationFormData;
  errors?: RegistrationFormErrors;
  showRemove?: boolean;
  hideEmergencyContact?: boolean;
  onRemove?: () => void;
  onChange: (field: keyof RegistrationFormData, value: string | boolean) => void;
}

export default function ParticipantFormSection({
  index,
  title,
  eventTitle,
  participant,
  errors = {},
  showRemove,
  hideEmergencyContact,
  onRemove,
  onChange,
}: ParticipantFormSectionProps) {
  const fieldKey = (field: RegistrationFormField) => `${index}-${field}`;

  return (
    <div className="bg-dark rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary">
          {title}
        </h2>
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-muted hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RegisterField
          label="First name *"
          error={errors.firstName}
          fieldKey={fieldKey("firstName")}
        >
          <input
            type="text"
            value={participant.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            placeholder="Alex"
            className={inputCls(!!errors.firstName)}
          />
        </RegisterField>
        <RegisterField
          label="Last name *"
          error={errors.lastName}
          fieldKey={fieldKey("lastName")}
        >
          <input
            type="text"
            value={participant.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            placeholder="Rossi"
            className={inputCls(!!errors.lastName)}
          />
        </RegisterField>
      </div>

      <RegisterField
        label="Date of birth *"
        error={errors.dateOfBirth}
        fieldKey={fieldKey("dateOfBirth")}
      >
        <input
          type="date"
          value={participant.dateOfBirth}
          onChange={(e) => onChange("dateOfBirth", e.target.value)}
          max={maxDateOfBirthForMinAge()}
          className={inputCls(!!errors.dateOfBirth)}
        />
      </RegisterField>

      <RegisterField label="Email *" error={errors.email} fieldKey={fieldKey("email")}>
        <input
          type="email"
          value={participant.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="alex@example.com"
          className={inputCls(!!errors.email)}
        />
      </RegisterField>

      <RegisterField label="Mobile *" error={errors.mobile} fieldKey={fieldKey("mobile")}>
        <input
          type="tel"
          value={participant.mobile}
          onChange={(e) => onChange("mobile", e.target.value)}
          placeholder="0400 000 000"
          className={inputCls(!!errors.mobile)}
        />
      </RegisterField>

      {!hideEmergencyContact && (
      <div className="pt-2 border-t border-dark-border">
        <h3 className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted mb-3">
          Emergency contact
        </h3>
        <div className="space-y-4">
          <RegisterField
            label="Contact name *"
            error={errors.emergencyContactName}
            fieldKey={fieldKey("emergencyContactName")}
          >
            <input
              type="text"
              value={participant.emergencyContactName}
              onChange={(e) => onChange("emergencyContactName", e.target.value)}
              placeholder="Jamie Rossi"
              className={inputCls(!!errors.emergencyContactName)}
            />
          </RegisterField>
          <RegisterField
            label="Contact number *"
            error={errors.emergencyContactPhone}
            fieldKey={fieldKey("emergencyContactPhone")}
          >
            <input
              type="tel"
              value={participant.emergencyContactPhone}
              onChange={(e) => onChange("emergencyContactPhone", e.target.value)}
              placeholder="0400 000 001"
              className={inputCls(!!errors.emergencyContactPhone)}
            />
          </RegisterField>
        </div>
      </div>
      )}

      <div
        className={cn(
          "flex items-start gap-3 pt-2 rounded-md",
          errors.waiverAccepted && "ring-1 ring-red-500/50 p-3 -mx-1"
        )}
        data-invalid={errors.waiverAccepted ? fieldKey("waiverAccepted") : undefined}
      >
        <Checkbox
          id={`waiver-${index}`}
          checked={participant.waiverAccepted}
          onCheckedChange={(checked) => onChange("waiverAccepted", checked === true)}
          className={cn(
            "mt-0.5 border-dark-border bg-dark-light data-[state=checked]:bg-primary data-[state=checked]:border-primary",
            errors.waiverAccepted && "border-red-500/70"
          )}
        />
        <div>
          <label htmlFor={`waiver-${index}`} className="text-[13px] text-muted leading-relaxed cursor-pointer">
            I have read and accept the event waiver, including the assumption of risk and release of liability for participation in {eventTitle}.
          </label>
          {errors.waiverAccepted && (
            <p className="mt-1.5 font-headline text-[11px] font-medium text-red-400">
              {errors.waiverAccepted}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
