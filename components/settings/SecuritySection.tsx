"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  ArrowRight, Check, Copy, Eye, EyeOff, KeyRound, Link2, Plus, Shield, Trash2, Unlink,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { isPasswordValid, PASSWORD_POLICY_SUMMARY } from "@/lib/password-policy";
import {
  providerLabel,
  providerListLabel,
  type SignInProvider,
} from "@/lib/account-sign-in-shared";
import PasswordRequirements from "@/components/PasswordRequirements";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ErrorNote, SectionShell, SuccessNote, cardCls, inputCls, labelCls, outlineBtnCls,
} from "@/components/settings/primitives";
import { DeleteAccountCard, EmailCard, SessionsCard } from "@/components/settings/AccountCards";

const btnCls = outlineBtnCls;

type Message = { kind: "error" | "success"; text: string } | null;

type SecurityState = {
  providers:   SignInProvider[];
  hasPassword: boolean;
  mfaEnabled:  boolean;
};

function Note({ message }: { message: Message }) {
  if (!message) return null;
  return message.kind === "error" ? <ErrorNote>{message.text}</ErrorNote> : <SuccessNote>{message.text}</SuccessNote>;
}

async function postMfa(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, string> }> {
  const r = await fetch("/api/user/mfa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

// ── Sign-in method ───────────────────────────────────────────────────────────
// A Google or Apple profile owns the email address. Until every provider is
// unlinked, the email field here would only be overwritten on the next
// provider sign-in, so it is replaced by this card.

function ProviderSignInCard({
  providers, hasPassword, email, onUnlink,
}: {
  providers: SignInProvider[];
  hasPassword: boolean;
  email: string;
  onUnlink: (provider: SignInProvider) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<SignInProvider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (providers.length === 0) return null;

  const names = providerListLabel(providers);

  const unlink = async (provider: SignInProvider) => {
    setBusy(true);
    setError("");
    try {
      await onUnlink(provider);
      setConfirming(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink that sign-in method.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-start gap-3">
        <Link2 className="w-5 h-5 mt-0.5 shrink-0 text-muted-dark" />
        <div className="min-w-0">
          <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Sign-in method</h4>
          <p className="text-muted text-[12px] mt-0.5 leading-relaxed">
            You sign in with <span className="text-light">{names}</span>.
          </p>
          <p className="text-muted text-[12px] mt-1 break-all">{email || "The address held by your provider."}</p>
          <p className="text-muted-dark text-[11px] mt-2 leading-relaxed">
            {hasPassword
              ? `Your password works too. To change your email here, unlink ${names} first.`
              : `Your email is managed by ${names}. Change it there, then sign in again.`}
          </p>
        </div>
      </div>

      {hasPassword && (
        <div className="border-t border-dark-lighter pt-4 space-y-2">
          <p className="text-[12px] text-muted leading-relaxed">
            Unlinking removes {names} from this account. Keep your password somewhere safe:
            you will use it to sign in afterwards.
          </p>
          {providers.map((provider) => (
            <div key={provider}>
              {confirming === provider ? (
                <div className="border border-dark-lighter rounded-lg p-3 space-y-3">
                  <p className="text-[12px] text-red-300 leading-relaxed">
                    Unlink {providerLabel(provider)}? If you sign in with it again before
                    changing your email, it may be linked back to this account.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => unlink(provider)} disabled={busy}
                      className={btnCls + " border-red-500/30 text-red-400 hover:bg-red-500/10"}>
                      <Unlink className="w-3.5 h-3.5" /> {busy ? "Unlinking…" : `Yes, unlink ${providerLabel(provider)}`}
                    </button>
                    <button type="button" onClick={() => { setConfirming(null); setError(""); }} disabled={busy}
                      className={btnCls + " border-dark-lighter text-muted hover:text-light"}>
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setConfirming(provider); setError(""); }}
                  className={btnCls + " border-dark-lighter text-muted hover:text-light"}>
                  <Unlink className="w-3.5 h-3.5" /> Unlink {providerLabel(provider)}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

// ── Set a password ───────────────────────────────────────────────────────────
// A provider-only profile has no current password to verify. The server adds a
// permanent password to the existing Cognito profile, so the app account and
// all of its data stay on the same subject.

function SetPasswordCard({ onSet }: { onSet: () => void }) {
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const setPassword = async () => {
    setMessage(null);
    if (!isPasswordValid(newPw)) { setMessage({ kind: "error", text: "Password must be " + PASSWORD_POLICY_SUMMARY }); return; }
    if (newPw !== confirmPw) { setMessage({ kind: "error", text: "The passwords do not match." }); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPw }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage({ kind: "error", text: typeof data.error === "string" ? data.error : "Could not set your password." });
        return;
      }
      setNewPw(""); setConfirmPw("");
      setMessage({ kind: "success", text: "Password added. You can now sign in with it." });
      onSet();
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const type = showPw ? "text" : "password";

  return (
    <div className={cardCls}>
      <div className="flex items-start gap-3">
        <KeyRound className="w-5 h-5 mt-0.5 shrink-0 text-muted-dark" />
        <div>
          <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Set a password</h4>
          <p className="text-muted text-[12px] mt-0.5 leading-relaxed">
            Add a password so you can sign in without Google or Apple. You stay signed in to this account.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPassword(); }} className="space-y-3">
        <div>
          <label htmlFor="settings-set-pw" className={labelCls}>New password</label>
          <div className="relative">
            <input id="settings-set-pw" type={type} required autoComplete="new-password" value={newPw}
              onChange={(e) => setNewPw(e.target.value)} aria-describedby="settings-set-pw-requirements"
              className={`${inputCls} pr-11`} />
            <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? "Hide passwords" : "Show passwords"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div id="settings-set-pw-requirements">
            <PasswordRequirements password={newPw} />
          </div>
        </div>
        <div>
          <label htmlFor="settings-set-pw-confirm" className={labelCls}>Confirm new password</label>
          <input id="settings-set-pw-confirm" type={type} required autoComplete="new-password" value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)} className={inputCls} />
        </div>
        <Note message={message} />
        <button type="submit" disabled={saving || !isPasswordValid(newPw)}
          className={btnCls + " border-primary/30 text-primary hover:bg-primary/10"}>
          {saving ? "Saving…" : <>Set password <ArrowRight className="w-3.5 h-3.5" /></>}
        </button>
      </form>
    </div>
  );
}

// ── Change password ──────────────────────────────────────────────────────────

function PasswordCard() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const changePassword = async () => {
    setMessage(null);
    if (!isPasswordValid(newPw)) { setMessage({ kind: "error", text: "New password must be " + PASSWORD_POLICY_SUMMARY }); return; }
    if (newPw !== confirmPw) { setMessage({ kind: "error", text: "The new passwords do not match." }); return; }
    setSaving(true);
    try {
      const { ok, data } = await postMfa({ action: "change-password", currentPassword: currentPw, newPassword: newPw });
      if (ok) {
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        setMessage({ kind: "success", text: "Password changed." });
      } else {
        setMessage({ kind: "error", text: data.error || "Could not change your password." });
      }
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const type = showPw ? "text" : "password";

  return (
    <div className={cardCls}>
      <div className="flex items-start gap-3">
        <KeyRound className="w-5 h-5 mt-0.5 shrink-0 text-muted-dark" />
        <div>
          <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Password</h4>
          <p className="text-muted text-[12px] mt-0.5">Change the password you sign in with.</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); changePassword(); }} className="space-y-3">
        <div>
          <label htmlFor="settings-current-pw" className={labelCls}>Current password</label>
          <div className="relative">
            <input id="settings-current-pw" type={type} required autoComplete="current-password" value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)} className={`${inputCls} pr-11`} />
            <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? "Hide passwords" : "Show passwords"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="settings-new-pw" className={labelCls}>New password</label>
          <input id="settings-new-pw" type={type} required autoComplete="new-password" value={newPw}
            onChange={(e) => setNewPw(e.target.value)} aria-describedby="settings-pw-requirements" className={inputCls} />
          <div id="settings-pw-requirements">
            <PasswordRequirements password={newPw} />
          </div>
        </div>
        <div>
          <label htmlFor="settings-confirm-pw" className={labelCls}>Confirm new password</label>
          <input id="settings-confirm-pw" type={type} required autoComplete="new-password" value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)} className={inputCls} />
        </div>
        <Note message={message} />
        <button type="submit" disabled={saving || !currentPw || !isPasswordValid(newPw)}
          className={btnCls + " border-primary/30 text-primary hover:bg-primary/10"}>
          {saving ? "Updating…" : <>Change password <ArrowRight className="w-3.5 h-3.5" /></>}
        </button>
      </form>
    </div>
  );
}

// ── Authenticator app ────────────────────────────────────────────────────────
// TOTP is a Cognito challenge on the password flow. A Google or Apple sign-in
// goes through the provider, so the copy says exactly what the code protects.

function AuthenticatorCard({
  enabled, canUse, onChange,
}: {
  enabled: boolean;
  canUse: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { user } = useAuthContext();
  const [step, setStep] = useState<"idle" | "starting" | "scan" | "verifying" | "confirm-disable" | "disabling">("idle");
  const [secretCode, setSecretCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [message, setMessage] = useState<Message>(null);

  const startSetup = async () => {
    if (!canUse) return;
    setMessage(null);
    setStep("starting");
    try {
      const { ok, data } = await postMfa({ action: "setup" });
      if (!ok || !data.secretCode) {
        setMessage({ kind: "error", text: data.error || "Could not start setup." });
        setStep("idle");
        return;
      }
      // The QR code is drawn in the browser. The secret is the second factor
      // itself, so it is never put in a URL sent to another service.
      const account = encodeURIComponent(user?.email || "account");
      const uri = `otpauth://totp/Startline:${account}?secret=${data.secretCode}&issuer=Startline`;
      setQrDataUrl(await QRCode.toDataURL(uri, { width: 384, margin: 1 }));
      setSecretCode(data.secretCode);
      setStep("scan");
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
      setStep("idle");
    }
  };

  const verifySetup = async () => {
    setMessage(null);
    setStep("verifying");
    try {
      const { ok, data } = await postMfa({ action: "verify-setup", code: totpCode });
      if (!ok) {
        setMessage({ kind: "error", text: data.error || "That code did not match. Try again." });
        setStep("scan");
        return;
      }
      setTotpCode(""); setSecretCode(""); setQrDataUrl("");
      setStep("idle");
      onChange(true);
      setMessage({ kind: "success", text: "Authenticator app turned on." });
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
      setStep("scan");
    }
  };

  const disable = async () => {
    setMessage(null);
    setStep("disabling");
    try {
      const { ok, data } = await postMfa({ action: "disable" });
      if (!ok) {
        setMessage({ kind: "error", text: data.error || "Could not turn off the authenticator app." });
      } else {
        onChange(false);
        setMessage({ kind: "success", text: "Authenticator app turned off." });
      }
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setStep("idle");
    }
  };

  const settingUp = step === "scan" || step === "verifying";

  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Shield className={`w-5 h-5 mt-0.5 shrink-0 ${enabled ? "text-primary" : "text-muted-dark"}`} />
          <div>
            <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Authenticator app</h4>
            <p className="text-muted text-[12px] mt-0.5 leading-relaxed">
              {enabled
                ? "On. You are asked for a code from your app when you sign in with your password."
                : canUse
                  ? "Off. Add a second step to password sign-in with a code from an app such as Google Authenticator."
                  : "Set a password first. Authenticator codes protect password sign-ins."}
            </p>
            <p className="text-muted-dark text-[11px] mt-1 leading-relaxed">
              Google and Apple sign-ins use those providers&apos; security settings.
            </p>
          </div>
        </div>
        {!enabled && canUse && (step === "idle" || step === "starting") && (
          <button type="button" onClick={startSetup} disabled={step === "starting"}
            className={btnCls + " shrink-0 border-primary/30 text-primary hover:bg-primary/10"}>
            <Plus className="w-3.5 h-3.5" /> {step === "starting" ? "Starting…" : "Set up"}
          </button>
        )}
        {enabled && step === "idle" && (
          <button type="button" onClick={() => { setMessage(null); setStep("confirm-disable"); }}
            className={btnCls + " shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"}>
            <Trash2 className="w-3.5 h-3.5" /> Turn off
          </button>
        )}
      </div>

      {enabled && (step === "confirm-disable" || step === "disabling") && (
        <div className="border-t border-dark-lighter pt-4">
          <p className="text-[13px] text-muted leading-relaxed">
            Turn off the authenticator app? Your password alone will be enough to sign in.
          </p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={disable} disabled={step === "disabling"}
              className={btnCls + " border-red-500/30 text-red-400 hover:bg-red-500/10"}>
              {step === "disabling" ? "Turning off…" : "Yes, turn off"}
            </button>
            <button type="button" onClick={() => setStep("idle")} disabled={step === "disabling"}
              className={btnCls + " border-dark-lighter text-muted hover:text-light"}>
              Keep it on
            </button>
          </div>
        </div>
      )}

      {!enabled && settingUp && (
        <div className="border-t border-dark-lighter pt-4 space-y-4">
          <p className="text-[13px] text-muted leading-relaxed">
            Scan this code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          <div className="flex justify-center">
            <Image src={qrDataUrl} alt="Authenticator setup QR code" width={192} height={192} unoptimized className="w-48 h-48 rounded-lg" />
          </div>
          <div className="bg-dark-light rounded-lg p-3">
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted mb-2">Or enter this key manually</p>
            <div className="flex items-center justify-between gap-2">
              <code className="font-mono text-[13px] tracking-[0.2em] text-light select-all break-all">
                {secretCode.match(/.{1,4}/g)?.join(" ")}
              </code>
              <button type="button" aria-label="Copy setup key"
                onClick={() => { navigator.clipboard.writeText(secretCode); setSecretCopied(true); setTimeout(() => setSecretCopied(false), 2000); }}
                className="shrink-0 text-muted hover:text-primary transition-colors p-1">
                {secretCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); verifySetup(); }} className="flex gap-2">
            <input type="text" inputMode="numeric" autoComplete="one-time-code" aria-label="6-digit code"
              value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className={`${inputCls} flex-1 tracking-[0.5em] text-center font-bold`} />
            <button type="submit" disabled={totpCode.length < 6 || step === "verifying"}
              className={btnCls + " border-primary/30 text-primary hover:bg-primary/10"}>
              {step === "verifying" ? "Verifying…" : <>Verify <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>
          <button type="button" onClick={() => { setStep("idle"); setTotpCode(""); setMessage(null); }}
            className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light transition-colors">
            Cancel setup
          </button>
        </div>
      )}

      <Note message={message} />
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

export default function SecuritySection() {
  const { user } = useAuthContext();
  const [state, setState] = useState<SecurityState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/security")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load your sign-in methods.");
        return r.json();
      })
      .then((data: Partial<SecurityState>) => {
        if (cancelled) return;
        setState({
          providers:   Array.isArray(data.providers) ? data.providers : [],
          hasPassword: Boolean(data.hasPassword),
          mfaEnabled:  Boolean(data.mfaEnabled),
        });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your sign-in methods. Please try again.");
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => {
    setError("");
    setReloadKey((key) => key + 1);
  };

  const unlink = async (provider: SignInProvider) => {
    const r = await fetch("/api/user/identities/unlink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Could not unlink that sign-in method.");
    }
    // The ID token still carries the old identity until it is refreshed.
    await fetchAuthSession({ forceRefresh: true }).catch(() => {});
    setNotice(`${providerLabel(provider)} unlinked.`);
    reload();
  };

  if (error) {
    return (
      <SectionShell title="Login & security" description="Your email, your password and the second step you use to sign in.">
        <div className="space-y-4">
          <ErrorNote>{error}</ErrorNote>
          <button type="button" onClick={reload} className={btnCls + " border-dark-lighter text-muted hover:text-light"}>
            Try again
          </button>
        </div>
      </SectionShell>
    );
  }

  if (!state) {
    return (
      <SectionShell title="Login & security" description="Your email, your password and the second step you use to sign in.">
        <div className="space-y-5">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Login & security" description="Your email, your password and the second step you use to sign in.">
      <div className="space-y-5">
        {notice && <SuccessNote>{notice}</SuccessNote>}
        {state.providers.length > 0 ? (
          <ProviderSignInCard
            providers={state.providers}
            hasPassword={state.hasPassword}
            email={user?.email ?? ""}
            onUnlink={unlink}
          />
        ) : state.hasPassword ? (
          <EmailCard />
        ) : null}
        {state.hasPassword ? <PasswordCard /> : <SetPasswordCard onSet={() => { setNotice("Password added."); reload(); }} />}
        <AuthenticatorCard
          enabled={state.mfaEnabled}
          canUse={state.hasPassword}
          onChange={(enabled) => setState((current) => current ? { ...current, mfaEnabled: enabled } : current)}
        />
        <SessionsCard hasPassword={state.hasPassword} providers={state.providers} />
        <DeleteAccountCard />
      </div>
    </SectionShell>
  );
}
