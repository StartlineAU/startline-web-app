"use client";

import { RegisterField, registerInputCls } from "@/components/registration/RegisterField";
import type { EmergencyContactErrors } from "@/lib/registration-form";

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
    <div className="bg-dark border border-dark-lighter rounded-[14px] p-6">
      <div className="font-headline text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-dark pb-2.5 border-b border-dark-lighter mb-4">
        Shared emergency contact
      </div>
      <p className="text-[12px] text-muted leading-relaxed mb-4">
        One emergency contact for the whole group. This must be someone other than any participant.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
        <RegisterField label="Contact name" required error={errors.emergencyContactName} fieldKey="shared-emergencyContactName" htmlFor="shared-ecName">
          <input
            id="shared-ecName"
            type="text"
            value={name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Full name"
            autoComplete="section-emergency-contact name"
            className={registerInputCls(!!errors.emergencyContactName)}
          />
        </RegisterField>
        <RegisterField label="Contact phone" required error={errors.emergencyContactPhone} fieldKey="shared-emergencyContactPhone" htmlFor="shared-ecPhone">
          <input
            id="shared-ecPhone"
            type="tel"
            value={phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="e.g. 0412 000 111"
            autoComplete="section-emergency-contact tel"
            className={registerInputCls(!!errors.emergencyContactPhone)}
          />
        </RegisterField>
      </div>
    </div>
  );
}
