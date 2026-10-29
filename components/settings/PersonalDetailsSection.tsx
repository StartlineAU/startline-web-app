"use client";

import { useEffect, useState } from "react";
import { GENDER_OPTIONS, maxDateOfBirthForMinAge } from "@/lib/registration-form";
import { useSettings } from "@/context/SettingsContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ErrorNote, FieldLabel, GroupHeading, SaveFooter, SectionShell, inputCls,
} from "@/components/settings/primitives";

type DetailsDraft = {
  name: string;
  mobile: string;
  dateOfBirth: string;
  gender: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

const EMPTY: DetailsDraft = {
  name: "", mobile: "", dateOfBirth: "", gender: "", emergencyContactName: "", emergencyContactPhone: "",
};

const TITLE = "Personal details";
const DESCRIPTION =
  "Not shown on your public profile. Used only to prefill your own event registrations. Organisers receive these details when you register.";

export default function PersonalDetailsSection() {
  const { notifyProfileSaved } = useSettings();

  const [form, setForm] = useState<DetailsDraft>(EMPTY);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    // A late reply must not land on top of what has been typed since: in
    // development the effect runs twice, and the second fetch did exactly that.
    let cancelled = false;
    fetch("/api/user/profile")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return;
        if (!data) { setLoadState("failed"); return; }
        setForm({
          name:                  data.name ?? "",
          mobile:                data.mobile ?? "",
          dateOfBirth:           data.dateOfBirth ?? "",
          gender:                data.gender ?? "",
          emergencyContactName:  data.emergencyContactName ?? "",
          emergencyContactPhone: data.emergencyContactPhone ?? "",
        });
        setLoadState("ready");
      })
      .catch(() => { if (!cancelled) setLoadState("failed"); });
    return () => { cancelled = true; };
  }, []);

  const patch = (p: Partial<DetailsDraft>) => setForm(f => ({ ...f, ...p }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Only these fields are sent, so the public profile is left as it is.
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          mobile: form.mobile || null,
          dateOfBirth: form.dateOfBirth || null,
          gender: form.gender || null,
          emergencyContactName: form.emergencyContactName || null,
          emergencyContactPhone: form.emergencyContactPhone || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save your details.");
        return;
      }
      notifyProfileSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadState === "loading") {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <div className="space-y-5" role="status" aria-label="Loading details">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </SectionShell>
    );
  }

  if (loadState === "failed") {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <ErrorNote>Your details could not be loaded. Close settings and try again.</ErrorNote>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title={TITLE}
      description={DESCRIPTION}
      footer={<SaveFooter saving={saving} saved={saved} onSave={handleSave} />}
    >
      <div className="space-y-8">
        <div>
          <GroupHeading>About you</GroupHeading>
          <div className="space-y-4">
            <div>
              <FieldLabel label="Full name" htmlFor="settings-name" />
              <input id="settings-name" className={inputCls} value={form.name}
                onChange={(e) => patch({ name: e.target.value })} placeholder="Your legal name" autoComplete="name" />
            </div>
            <div>
              <FieldLabel label="Phone" htmlFor="settings-mobile" />
              <input id="settings-mobile" className={inputCls} type="tel" value={form.mobile}
                onChange={(e) => patch({ mobile: e.target.value })} placeholder="e.g. 0412 345 678" autoComplete="tel" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Date of birth" htmlFor="settings-dob" />
                <input id="settings-dob" className={inputCls} type="date" value={form.dateOfBirth}
                  onChange={(e) => patch({ dateOfBirth: e.target.value })}
                  max={maxDateOfBirthForMinAge(13)} autoComplete="bday" />
              </div>
              <div>
                <FieldLabel label="Gender" hint="Optional" htmlFor="settings-gender" />
                <select id="settings-gender" className={inputCls} value={form.gender}
                  onChange={(e) => patch({ gender: e.target.value })}>
                  <option value="">Select…</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div>
          <GroupHeading>Emergency contact</GroupHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Emergency contact name" htmlFor="settings-ec-name" />
              <input id="settings-ec-name" className={inputCls} value={form.emergencyContactName}
                onChange={(e) => patch({ emergencyContactName: e.target.value })} placeholder="Full name" autoComplete="off" />
            </div>
            <div>
              <FieldLabel label="Emergency contact phone" htmlFor="settings-ec-phone" />
              <input id="settings-ec-phone" className={inputCls} type="tel" value={form.emergencyContactPhone}
                onChange={(e) => patch({ emergencyContactPhone: e.target.value })} placeholder="e.g. 0412 000 111" autoComplete="off" />
            </div>
          </div>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </SectionShell>
  );
}
