"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, SaveFooter, SectionShell, Switch } from "@/components/settings/primitives";

type Key = "notifyEventApproved" | "notifyEventRejected" | "notifyNewRegistration" | "notifyManagers";

const KINDS: { key: Key; id: string; label: string; desc: string }[] = [
  { key: "notifyEventApproved",   id: "notify-approved-label",     label: "Event approved",   desc: "When your event is approved by admin"      },
  { key: "notifyEventRejected",   id: "notify-rejected-label",     label: "Event rejected",   desc: "When your event is rejected with feedback" },
  { key: "notifyNewRegistration", id: "notify-registration-label", label: "New registration", desc: "When an athlete registers for your event"  },
];

const TITLE = "Notifications";
const DESCRIPTION =
  "Choose what your organisation is told about. A notification that is off is not shown in the portal and is not emailed. Approval and rejection emails also go to your contact email.";

// Every switch here is a real control. Like the other sections, nothing is
// sent until Save is pressed. They belong to the organisation, so only an
// owner can change them, and the API enforces that; a manager sees the
// current state and no Save button.
export default function OrganisationNotificationsSection() {
  // `prefs` is what the switches show; `stored` is what the server last had.
  const [prefs,   setPrefs]   = useState<Record<Key, boolean> | null>(null);
  const [stored,  setStored]  = useState<Record<Key, boolean> | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    // A late reply must not undo a toggle made since: in development the
    // effect runs twice, and the second fetch put the switch back.
    let cancelled = false;
    fetch("/api/organiser/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        if (!data) { setLoadFailed(true); return; }
        const loaded = {
          notifyEventApproved:   data.notifyEventApproved   !== false,
          notifyEventRejected:   data.notifyEventRejected   !== false,
          notifyNewRegistration: data.notifyNewRegistration !== false,
          notifyManagers:        data.notifyManagers        !== false,
        };
        setPrefs(loaded);
        setStored(loaded);
        setIsOwner(data.role === "OWNER");
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (key: Key) => {
    if (!prefs || !isOwner || saving) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
    setSaved(false);
  };

  const changed = prefs && stored
    ? (Object.keys(prefs) as Key[]).filter(key => prefs[key] !== stored[key])
    : [];

  const handleSave = async () => {
    if (!prefs || changed.length === 0) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/organiser/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(changed.map(key => [key, prefs[key]]))),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save. Please try again.");
        return;
      }
      setStored(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Could not save. Please try again.");
    } finally { setSaving(false); }
  };

  if (loadFailed) {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <ErrorNote>Your notification settings could not be loaded. Close settings and try again.</ErrorNote>
      </SectionShell>
    );
  }

  if (!prefs) {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <div className="space-y-3" role="status" aria-label="Loading notification settings">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </SectionShell>
    );
  }

  const locked = !isOwner || saving;

  return (
    <SectionShell
      title={TITLE}
      description={DESCRIPTION}
      footer={isOwner
        ? <SaveFooter saving={saving} saved={saved} disabled={changed.length === 0} onSave={handleSave} />
        : undefined}
    >
      <div className="space-y-1">
        {KINDS.map(({ key, id, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-dark-lighter last:border-0">
            <div>
              <div id={id} className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">{label}</div>
              <div className="text-[11px] text-muted-dark mt-0.5">{desc}</div>
            </div>
            <Switch checked={prefs[key]} onChange={() => toggle(key)} disabled={locked} labelledBy={id} />
          </div>
        ))}
      </div>

      <div className="mt-6 border border-dark-lighter rounded-lg p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div id="notify-managers-label" className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">Include managers</div>
            <div className="text-[11px] text-muted-dark mt-0.5">
              Managers of this organisation see these notifications and are copied on the emails.
            </div>
          </div>
          <Switch checked={prefs.notifyManagers} onChange={() => toggle("notifyManagers")} disabled={locked} labelledBy="notify-managers-label" />
        </div>
      </div>

      {!isOwner && (
        <p className="text-[11px] text-muted-dark mt-3">Only the owner can change this.</p>
      )}
      {error && <p role="alert" className="text-[11px] text-red-400 mt-3">{error}</p>}
    </SectionShell>
  );
}
