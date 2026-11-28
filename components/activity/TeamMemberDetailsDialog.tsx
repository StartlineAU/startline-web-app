"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ParticipantFormSection, { GUEST_EMAIL_HINT } from "@/components/registration/ParticipantFormSection";
import {
  createEmptyParticipant,
  getRegistrationFormErrors,
  type RegistrationFormData,
  type RegistrationFormErrors,
} from "@/lib/registration-form";

export interface PendingTeamPlace {
  id: string;
  /** "Team member 2", until the details are in. */
  athleteName: string;
  teamName: string | null;
  eventTitle: string;
}

/**
 * Add the details of a team member the buyer left for later at checkout.
 * The same form checkout uses, posted to /api/user/registrations/[id]/details.
 */
export default function TeamMemberDetailsDialog({
  place,
  onClose,
  onSaved,
}: {
  place: PendingTeamPlace | null;
  onClose: () => void;
  onSaved: (id: string, athleteName: string) => void;
}) {
  const [person, setPerson] = useState<RegistrationFormData>(() => createEmptyParticipant());
  const [errors, setErrors] = useState<RegistrationFormErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPerson(createEmptyParticipant());
    setErrors({});
    setError("");
  };

  const save = async () => {
    if (!place) return;
    const fieldErrors = getRegistrationFormErrors(person, { includeEmergencyContact: true, includeWaiver: false });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/user/registrations/${place.id}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          dateOfBirth: person.dateOfBirth,
          gender: person.gender,
          mobile: person.mobile,
          emergencyContactName: person.emergencyContactName,
          emergencyContactPhone: person.emergencyContactPhone,
          medicalNotes: person.medicalNotes,
          estimatedFinish: person.estimatedFinish,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not save these details.");
        return;
      }
      onSaved(place.id, json.athleteName ?? `${person.firstName} ${person.lastName}`.trim());
      reset();
    } catch {
      setError("Could not save these details. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!place} onOpenChange={(open) => { if (!open) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="team-member-details-dialog">
        <DialogHeader>
          <DialogTitle>Add {place?.athleteName ?? "team member"}</DialogTitle>
          <DialogDescription>
            {place?.teamName ? `Team ${place.teamName} · ` : ""}{place?.eventTitle}. Their place is paid for;
            this tells the organiser who is racing. They get their own confirmation email.
          </DialogDescription>
        </DialogHeader>

        <ParticipantFormSection
          frameless
          index={0}
          participant={person}
          emailHint={GUEST_EMAIL_HINT}
          errors={errors}
          onChange={(field, value) => {
            setPerson((prev) => ({ ...prev, [field]: value }));
            setErrors((prev) => {
              if (!prev[field as keyof RegistrationFormErrors]) return prev;
              const next = { ...prev };
              delete next[field as keyof RegistrationFormErrors];
              return next;
            });
          }}
        />

        {error && <p className="text-[13px] text-red-300">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Not now</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
