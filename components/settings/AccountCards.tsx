"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { ArrowRight, LogOut, Mail, TriangleAlert } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { customerHref, organiserHref } from "@/lib/portal-domains";
import { usePortalHost } from "@/lib/use-portal-host";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ErrorNote, SuccessNote, cardCls, inputCls, labelCls, outlineBtnCls,
} from "@/components/settings/primitives";

const primaryBtn = outlineBtnCls + " border-primary/30 text-primary hover:bg-primary/10";
const neutralBtn = outlineBtnCls + " border-dark-lighter text-muted hover:text-light";
const dangerBtn  = outlineBtnCls + " border-red-500/30 text-red-400 hover:bg-red-500/10";

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const r = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

const errorOf = (data: Record<string, unknown>, fallback: string) =>
  typeof data.error === "string" ? data.error : fallback;

// ── Email ───────────────────────────────────────────────────────────────────
// Two steps: a code goes to the new address, and the address only changes
// once that code comes back. A typo therefore cannot lock anyone out.

export function EmailCard() {
  const { user, refresh } = useAuthContext();
  const { notifyProfileSaved } = useSettings();
  const [step, setStep] = useState<"idle" | "enter" | "code">("idle");
  const [email, setEmail] = useState("");
  const [code,  setCode]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  const [done,  setDone]  = useState("");

  const requestCode = async () => {
    setBusy(true); setError("");
    try {
      const { ok, data } = await send("/api/user/email", "POST", { action: "request", email });
      if (!ok) { setError(errorOf(data, "Could not send a code to that address.")); return; }
      setStep("code");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const confirmCode = async () => {
    setBusy(true); setError("");
    try {
      const { ok, data } = await send("/api/user/email", "POST", { action: "confirm", code });
      if (!ok) { setError(errorOf(data, "That code did not match.")); return; }
      // The address shown around the app comes from the sign-in token, which
      // still carries the old one until it is refreshed.
      await fetchAuthSession({ forceRefresh: true }).catch(() => {});
      await refresh();
      notifyProfileSaved();
      setDone(`Your email address is now ${typeof data.email === "string" ? data.email : email}.`);
      setStep("idle"); setEmail(""); setCode("");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const cancel = () => { setStep("idle"); setEmail(""); setCode(""); setError(""); };

  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Mail className="w-5 h-5 mt-0.5 shrink-0 text-muted-dark" />
          <div className="min-w-0">
            <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Email address</h4>
            <p className="text-muted text-[12px] mt-0.5 break-all">{user?.email || "The address you sign in with."}</p>
          </div>
        </div>
        {step === "idle" && (
          <button type="button" onClick={() => { setDone(""); setStep("enter"); }} className={primaryBtn + " shrink-0"}>
            Change
          </button>
        )}
      </div>

      {step === "enter" && (
        <form onSubmit={(e) => { e.preventDefault(); requestCode(); }} className="border-t border-dark-lighter pt-4 space-y-3">
          <div>
            <label htmlFor="settings-new-email" className={labelCls}>New email address</label>
            <input id="settings-new-email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            <p className="text-[11px] text-muted-dark mt-1.5">
              We will send a code to this address. Your email only changes once you enter it.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !email} className={primaryBtn}>
              {busy ? "Sending…" : <>Send code <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
            <button type="button" onClick={cancel} disabled={busy} className={neutralBtn}>Cancel</button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={(e) => { e.preventDefault(); confirmCode(); }} className="border-t border-dark-lighter pt-4 space-y-3">
          <div>
            <label htmlFor="settings-email-code" className={labelCls}>Code sent to {email}</label>
            <input id="settings-email-code" type="text" inputMode="numeric" autoComplete="one-time-code" required value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" className={`${inputCls} tracking-[0.5em] text-center font-bold`} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.length < 6} className={primaryBtn}>
              {busy ? "Checking…" : <>Confirm new email <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
            <button type="button" onClick={cancel} disabled={busy} className={neutralBtn}>Cancel</button>
          </div>
        </form>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {done && <SuccessNote>{done}</SuccessNote>}
    </div>
  );
}

// ── Sign out everywhere ─────────────────────────────────────────────────────
// For a lost phone or a shared computer. Cognito revokes every session's
// refresh token, so no device can renew its sign-in. A device that is open
// right now keeps working until its current token runs out, which is why the
// wording says "within the hour" and not "immediately".

export function SessionsCard() {
  const host = usePortalHost();
  const [confirming, setConfirming] = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  const signOutEverywhere = async () => {
    setBusy(true); setError("");
    try {
      await signOut({ global: true });
      window.location.assign(customerHref("/", host));
    } catch {
      setError("Could not sign out your other devices. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <LogOut className="w-5 h-5 mt-0.5 shrink-0 text-muted-dark" />
          <div>
            <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Sign out everywhere</h4>
            <p className="text-muted text-[12px] mt-0.5 leading-relaxed">
              Sign out of Startline on every phone, tablet and computer, including this one.
            </p>
          </div>
        </div>
        {!confirming && (
          <button type="button" onClick={() => setConfirming(true)} className={neutralBtn + " shrink-0"}>Sign out all</button>
        )}
      </div>
      {confirming && (
        <div className="border-t border-dark-lighter pt-4">
          <p className="text-[13px] text-muted leading-relaxed">
            You will be signed out here straight away, and on your other devices within the hour. You can sign back in with
            your password.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={signOutEverywhere} disabled={busy} className={primaryBtn}>
              {busy ? "Signing out…" : "Yes, sign out everywhere"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={neutralBtn}>Cancel</button>
          </div>
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

// ── Delete account ──────────────────────────────────────────────────────────

type Blocker = { organiserId: string; name: string; otherMembers: number; registrations: number };
type DeletionStatus = { blockers: Blocker[]; upcomingEntries: number };

function BlockingOrganisation({ org, onDeleted }: { org: Blocker; onDeleted: () => void }) {
  const host = usePortalHost();
  const { close } = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  // Deleting takes its events and entries with it, so it is only offered
  // while there are none. The API refuses otherwise.
  const canDelete = org.registrations === 0;

  const transfer = async () => {
    // The members page works on the active organisation, so make it this one.
    await send("/api/organiser/switch-org", "POST", { organiserId: org.organiserId }).catch(() => {});
    close();
    window.location.assign(organiserHref("/organiser/members", host));
  };

  const remove = async () => {
    setBusy(true); setError("");
    try {
      const { ok, data } = await send(`/api/user/account/organisations/${org.organiserId}`, "DELETE");
      if (!ok) { setError(errorOf(data, "Could not delete the organisation.")); setConfirming(false); return; }
      onDeleted();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="border border-dark-lighter rounded-lg p-3 space-y-3">
      <div>
        <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-light">{org.name}</div>
        <p className="text-[12px] text-muted mt-1 leading-relaxed">
          {org.otherMembers > 0
            ? "You are its only owner. Make another member the owner, and it carries on without you."
            : "You are its only member. Add someone and make them the owner, or delete the organisation."}
          {!canDelete && " It has taken entries, so it cannot be deleted here: those records have to be kept."}
        </p>
      </div>
      {confirming ? (
        <div className="space-y-2">
          <p className="text-[12px] text-red-300 leading-relaxed">
            Delete {org.name}? Its profile, events, merchandise and members are removed for good.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={remove} disabled={busy} className={dangerBtn}>
              {busy ? "Deleting…" : "Yes, delete organisation"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={neutralBtn}>Keep it</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={transfer} className={primaryBtn}>Transfer ownership</button>
          {canDelete && (
            <button type="button" onClick={() => setConfirming(true)} className={dangerBtn}>Delete organisation</button>
          )}
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

export function DeleteAccountCard() {
  const host = usePortalHost();
  const { logout } = useAuthContext();
  const [open,   setOpen]   = useState(false);
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmText, setConfirmText] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/user/account")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return;
        if (!data) { setError("Could not check your account. Please try again."); return; }
        setStatus({ blockers: data.blockers ?? [], upcomingEntries: data.upcomingEntries ?? 0 });
      })
      .catch(() => { if (!cancelled) setError("Could not check your account. Please try again."); });
    return () => { cancelled = true; };
  }, [open, reloadKey]);

  const deleteAccount = async () => {
    setBusy(true); setError("");
    try {
      const { ok, data } = await send("/api/user/account", "DELETE", { confirm: "DELETE" });
      if (!ok) {
        setError(errorOf(data, "Could not delete your account."));
        if (data.code === "OWNS_ORGANISATION") setReloadKey(k => k + 1);
        return;
      }
      // The login no longer exists; clear what the browser still holds.
      await logout().catch(() => {});
      window.location.assign(customerHref("/", host));
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const blocked = (status?.blockers.length ?? 0) > 0;

  return (
    <div className={cardCls + " border-red-500/20"}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0 text-red-400/80" />
          <div>
            <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Delete account</h4>
            <p className="text-muted text-[12px] mt-0.5 leading-relaxed">Permanently remove your account and sign-in.</p>
          </div>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={dangerBtn + " shrink-0"}>Delete</button>
        )}
      </div>

      {open && !status && !error && <Skeleton className="h-20 w-full rounded-lg" />}

      {open && status && (
        <div className="border-t border-dark-lighter pt-4 space-y-4">
          {blocked ? (
            <>
              <p className="text-[13px] text-muted leading-relaxed">
                Before your account can be deleted, sort out the {status.blockers.length === 1 ? "organisation" : "organisations"} you own:
              </p>
              {status.blockers.map(org => (
                <BlockingOrganisation key={org.organiserId} org={org}
                  onDeleted={() => { setStatus(null); setReloadKey(k => k + 1); }} />
              ))}
            </>
          ) : (
            <>
              <div className="text-[13px] text-muted leading-relaxed space-y-2">
                <p>
                  <span className="text-light">Removed for good:</span> your profile, personal details, follows, saved events,
                  notifications and any organisation memberships.
                </p>
                <p>
                  <span className="text-light">Kept:</span> entries you have made stay on each organiser&apos;s list, with the
                  details you gave at registration, but are no longer linked to an account.
                </p>
                {status.upcomingEntries > 0 && (
                  <p className="text-red-300">
                    You have {status.upcomingEntries} upcoming {status.upcomingEntries === 1 ? "entry" : "entries"}. They stay
                    valid, but you will not be able to view, manage or request a refund for them here. Contact the organiser
                    if you need to.
                  </p>
                )}
                <p>This cannot be undone.</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); deleteAccount(); }} className="space-y-3">
                <div>
                  <label htmlFor="settings-delete-confirm" className={labelCls}>Type DELETE to confirm</label>
                  <input id="settings-delete-confirm" value={confirmText} autoComplete="off"
                    onChange={(e) => setConfirmText(e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={busy || confirmText !== "DELETE"} className={dangerBtn}>
                    {busy ? "Deleting…" : "Delete my account"}
                  </button>
                  <button type="button" onClick={() => { setOpen(false); setConfirmText(""); setError(""); }} disabled={busy} className={neutralBtn}>
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}
          {blocked && (
            <button type="button" onClick={() => { setOpen(false); setError(""); }} className={neutralBtn}>Close</button>
          )}
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {open && !status && error && (
        <Link href="/contact" className="text-[12px] text-muted hover:text-primary underline">Contact support</Link>
      )}
    </div>
  );
}
