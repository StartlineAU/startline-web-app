"use client";

import { useState } from "react";
import { X } from "lucide-react";

const inputClass =
  "w-full bg-dark-light border border-dark-lighter rounded-md px-3 py-2.5 text-[14px] text-light focus:border-primary focus:outline-none transition-colors";
const labelClass = "font-headline text-[11px] font-bold uppercase tracking-widest text-light/70 block mb-1.5";

export interface CreatedOrganisation {
  orgName: string;
  email: string;
  inviteUrl: string | null;
}

// Sets up an organisation for an organiser who is not on Startline yet, so its
// events can be listed now and the organiser can claim it later
// (POST /api/admin/organisers, lib/organiser-claim.ts).
export default function AddOrganisationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (created: CreatedOrganisation) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    orgName: "", email: "", contactName: "", contactEmail: "", phone: "", abn: "", bio: "",
    verified: true, sendInvite: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/organisers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not create the organisation."); return; }
      await onCreated({
        orgName: data.organiser.orgName,
        email: data.organiser.email,
        inviteUrl: data.inviteUrl ?? null,
      });
    } catch {
      setError("Could not create the organisation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <form
        onSubmit={submit}
        aria-label="Add organisation"
        className="bg-dark border border-dark-lighter rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-1">New organisation</div>
            <h3 className="font-headline text-lg font-black italic tracking-tighter text-light">Add organisation</h3>
            <p className="text-[13px] text-muted mt-1">
              For an organiser who is not on Startline yet. List its events straight away, then invite them to claim it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label htmlFor="add-org-name" className={labelClass}>Organisation name *</label>
          <input id="add-org-name" className={inputClass} value={form.orgName}
            onChange={(e) => set("orgName", e.target.value)} required maxLength={200} />
        </div>
        <div>
          <label htmlFor="add-org-email" className={labelClass}>Organiser email *</label>
          <input id="add-org-email" type="email" className={inputClass} value={form.email}
            onChange={(e) => set("email", e.target.value)} required maxLength={255} />
          <p className="text-[12px] text-muted-dark mt-1">
            The claim invite goes here. They must sign in to Startline with this address to claim it.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="add-org-contact-name" className={labelClass}>Contact name</label>
            <input id="add-org-contact-name" className={inputClass} value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)} maxLength={200} />
          </div>
          <div>
            <label htmlFor="add-org-phone" className={labelClass}>Phone</label>
            <input id="add-org-phone" className={inputClass} value={form.phone}
              onChange={(e) => set("phone", e.target.value)} maxLength={50} />
          </div>
        </div>
        <div>
          <label htmlFor="add-org-contact-email" className={labelClass}>Public contact email</label>
          <input id="add-org-contact-email" type="email" className={inputClass} value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)} maxLength={255} placeholder="Defaults to the organiser email" />
        </div>
        <div>
          <label htmlFor="add-org-abn" className={labelClass}>ABN</label>
          <input id="add-org-abn" className={inputClass} value={form.abn}
            onChange={(e) => set("abn", e.target.value)} maxLength={20} inputMode="numeric" />
          <p className="text-[12px] text-muted-dark mt-1">
            Optional. Paid Startline events also need the organiser to finish Stripe after claiming.
          </p>
        </div>
        <div>
          <label htmlFor="add-org-bio" className={labelClass}>About</label>
          <textarea id="add-org-bio" rows={3} className={inputClass} value={form.bio}
            onChange={(e) => set("bio", e.target.value)} maxLength={2000} />
        </div>

        <label className="flex items-start gap-2.5 text-[13px] text-light cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-primary" checked={form.verified}
            onChange={(e) => set("verified", e.target.checked)} />
          <span>Verified. Events you post for it publish straight away.</span>
        </label>
        <label className="flex items-start gap-2.5 text-[13px] text-light cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-primary" checked={form.sendInvite}
            onChange={(e) => set("sendInvite", e.target.checked)} />
          <span>Email the claim invite now. You can also send it later.</span>
        </label>

        {error && <p role="alert" className="text-[13px] text-red-300">{error}</p>}

        <div className="flex justify-end items-center gap-4 pt-2">
          <button type="button" onClick={onClose}
            className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-dark shadow-machined font-headline text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create organisation"}
          </button>
        </div>
      </form>
    </div>
  );
}
