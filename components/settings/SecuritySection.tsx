"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { ArrowRight, Check, Copy, Eye, EyeOff, KeyRound, Plus, Shield, Trash2 } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { isPasswordValid, PASSWORD_POLICY_SUMMARY } from "@/lib/password-policy";
import PasswordRequirements from "@/components/PasswordRequirements";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ErrorNote, SectionShell, SuccessNote, cardCls, inputCls, labelCls, outlineBtnCls,
} from "@/components/settings/primitives";
import { DeleteAccountCard, EmailCard, SessionsCard } from "@/components/settings/AccountCards";

const btnCls = outlineBtnCls;

type Message = { kind: "error" | "success"; text: string } | null;

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

function AuthenticatorCard() {
  const { user } = useAuthContext();
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<"idle" | "starting" | "scan" | "verifying" | "confirm-disable" | "disabling">("idle");
  const [secretCode, setSecretCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/mfa")
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled) setMfaEnabled(Boolean(data?.mfaEnabled)); })
      .catch(() => { if (!cancelled) setMfaEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  const startSetup = async () => {
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
      setMfaEnabled(true);
      setTotpCode(""); setSecretCode(""); setQrDataUrl("");
      setStep("idle");
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
        setMfaEnabled(false);
        setMessage({ kind: "success", text: "Authenticator app turned off." });
      }
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setStep("idle");
    }
  };

  if (mfaEnabled === null) return <Skeleton className="h-24 w-full rounded-xl" />;

  const settingUp = step === "scan" || step === "verifying";

  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Shield className={`w-5 h-5 mt-0.5 shrink-0 ${mfaEnabled ? "text-primary" : "text-muted-dark"}`} />
          <div>
            <h4 className="font-headline text-[13px] font-bold uppercase tracking-widest text-light">Authenticator app</h4>
            <p className="text-muted text-[12px] mt-0.5 leading-relaxed">
              {mfaEnabled
                ? "On. You are asked for a code from your app each time you sign in."
                : "Off. Add a second step to sign-in with a code from an app such as Google Authenticator."}
            </p>
          </div>
        </div>
        {!mfaEnabled && (step === "idle" || step === "starting") && (
          <button type="button" onClick={startSetup} disabled={step === "starting"}
            className={btnCls + " shrink-0 border-primary/30 text-primary hover:bg-primary/10"}>
            <Plus className="w-3.5 h-3.5" /> {step === "starting" ? "Starting…" : "Set up"}
          </button>
        )}
        {mfaEnabled && step === "idle" && (
          <button type="button" onClick={() => { setMessage(null); setStep("confirm-disable"); }}
            className={btnCls + " shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"}>
            <Trash2 className="w-3.5 h-3.5" /> Turn off
          </button>
        )}
      </div>

      {mfaEnabled && (step === "confirm-disable" || step === "disabling") && (
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

      {!mfaEnabled && settingUp && (
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

export default function SecuritySection() {
  return (
    <SectionShell title="Login & security" description="Your email, your password and the second step you use to sign in.">
      <div className="space-y-5">
        <EmailCard />
        <PasswordCard />
        <AuthenticatorCard />
        <SessionsCard />
        <DeleteAccountCard />
      </div>
    </SectionShell>
  );
}
