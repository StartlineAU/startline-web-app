"use client";

import { useEffect, useState } from "react";
import { UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  cardCls, ErrorNote, inputCls, labelCls, outlineBtnCls, SectionShell,
} from "@/components/settings/primitives";

type Block = {
  id: string;
  email: string;
  name: string | null;
  note: string | null;
  createdByEmail: string;
  createdAt: string;
};

const TITLE = "Blocked athletes";
const DESCRIPTION =
  "People your organisation won't take entries from, at any of your events. They're matched by account and by email, and told only that they can't enter and should contact you.";

// The organisation's block list (#571). Removing an athlete from an event can
// add them here; an owner can also add or lift a block directly. Managers see
// the list but cannot change it, and the API enforces that.
export default function OrganisationBlockedAthletesSection() {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Ignore a reply that lands after cleanup: in development the effect runs
    // twice, and a late reply would overwrite what was just typed.
    let cancelled = false;
    fetch("/api/organiser/blocked-athletes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) { setLoadFailed(true); return; }
        setBlocks(data.blocks as Block[]);
        setIsOwner(data.role === "OWNER");
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const add = async () => {
    if (!email.trim() || adding) return;
    setAdding(true); setError("");
    try {
      const res = await fetch("/api/organiser/blocked-athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), ...(name.trim() ? { name: name.trim() } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not add this person. Please try again."); return; }
      setEmail(""); setName("");
      setReloadKey((k) => k + 1);
    } catch {
      setError("Could not add this person. Please try again.");
    } finally { setAdding(false); }
  };

  const lift = async (block: Block) => {
    setBusyId(block.id); setError("");
    try {
      const res = await fetch(`/api/organiser/blocked-athletes/${block.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not lift this block. Please try again.");
        return;
      }
      setBlocks((list) => (list ?? []).filter((b) => b.id !== block.id));
    } catch {
      setError("Could not lift this block. Please try again.");
    } finally { setBusyId(null); }
  };

  if (loadFailed) {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <ErrorNote>The blocked list could not be loaded. Close settings and try again.</ErrorNote>
      </SectionShell>
    );
  }

  if (!blocks) {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <div className="space-y-3" role="status" aria-label="Loading blocked athletes">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell title={TITLE} description={DESCRIPTION}>
      {isOwner && (
        <div className={cn(cardCls, "mb-6")} data-testid="block-add">
          <div>
            <label htmlFor="block-email" className={labelCls}>Email</label>
            <input
              id="block-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="athlete@example.com"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="block-name" className={labelCls}>Name (optional)</label>
            <input
              id="block-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={!email.trim() || adding}
            className={cn(outlineBtnCls, "border-dark-lighter text-light hover:border-primary hover:text-primary")}
          >
            <UserX className="w-3.5 h-3.5" /> {adding ? "Blocking…" : "Block"}
          </button>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="text-[13px] text-muted-dark" data-testid="block-empty">Nobody is blocked.</p>
      ) : (
        <ul className="divide-y divide-dark-lighter border-y border-dark-lighter" data-testid="block-list">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="font-headline text-[13px] font-bold text-light truncate">{b.name ?? b.email}</div>
                {b.name && <div className="text-[12px] text-muted truncate">{b.email}</div>}
                {b.note && <div className="text-[12px] text-muted-dark mt-0.5">{b.note}</div>}
                <div className="text-[11px] text-muted-dark mt-0.5">
                  Blocked {new Date(b.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} by {b.createdByEmail}
                </div>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => lift(b)}
                  disabled={busyId === b.id}
                  aria-label={`Unblock ${b.name ?? b.email}`}
                  className={cn(outlineBtnCls, "shrink-0 border-dark-lighter text-muted hover:border-primary hover:text-primary")}
                >
                  {busyId === b.id ? "Unblocking…" : "Unblock"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isOwner && (
        <p className="text-[11px] text-muted-dark mt-3">Only the owner can change this.</p>
      )}
      {error && <p role="alert" className="text-[11px] text-red-400 mt-3">{error}</p>}
    </SectionShell>
  );
}
