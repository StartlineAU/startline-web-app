"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, SaveFooter, SectionShell, Switch } from "@/components/settings/primitives";

const TITLE = "My notifications";
const DESCRIPTION = "What Startline tells you about as an athlete, in the site and by email.";

export default function AthleteNotificationsSection() {
  // `followed` is what the switch shows; `stored` is what the server last had.
  const [followed, setFollowed] = useState<boolean | null>(null);
  const [stored,   setStored]   = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    // A late reply must not undo a toggle made since (the effect runs twice
    // in development).
    let cancelled = false;
    fetch("/api/user/profile")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return;
        if (!data) { setLoadFailed(true); return; }
        const on = data.notifyFollowedOrganiserEvents !== false;
        setFollowed(on);
        setStored(on);
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (followed === null) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyFollowedOrganiserEvents: followed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save. Please try again.");
        return;
      }
      setStored(followed);
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

  if (followed === null) {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <div className="space-y-3" role="status" aria-label="Loading notification settings">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title={TITLE}
      description={DESCRIPTION}
      footer={<SaveFooter saving={saving} saved={saved} disabled={followed === stored} onSave={handleSave} />}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4 py-3 border-b border-dark-lighter">
          <div>
            <div id="alerts-followed-label" className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">
              New events from organisers you follow
            </div>
            <div className="text-[11px] text-muted-dark mt-0.5">
              A notification and an email when an organiser you follow publishes an event.
            </div>
          </div>
          <Switch checked={followed} onChange={() => { setFollowed(!followed); setSaved(false); }}
            disabled={saving} labelledBy="alerts-followed-label" />
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <div id="alerts-entries-label" className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">
              Your entries
            </div>
            <div className="text-[11px] text-muted-dark mt-0.5">
              Registration confirmations, start wave updates and refund updates. Always on, because they are about entries you have paid for.
            </div>
          </div>
          {/* Locked on: these are receipts and race-day information. */}
          <Switch checked onChange={() => {}} disabled labelledBy="alerts-entries-label" />
        </div>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-400 mt-3">{error}</p>}
    </SectionShell>
  );
}
