"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Mail, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuestEmailVerificationStepProps {
  eventId: string;
  eventTitle: string;
  emails: string[];
  onBack: () => void;
  onComplete: () => void;
}

export default function GuestEmailVerificationStep({
  eventId,
  eventTitle,
  emails,
  onBack,
  onComplete,
}: GuestEmailVerificationStepProps) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const sendStarted = useRef<Set<string>>(new Set());

  const allVerified = emails.length > 0 && emails.every((email) => verified[email]);

  useEffect(() => {
    emails.forEach((email) => {
      if (sendStarted.current.has(email)) return;
      sendStarted.current.add(email);
      setSending((prev) => ({ ...prev, [email]: true }));
      fetch("/api/register/verify-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email }),
      })
        .then(async (res) => {
          const data = await res.json() as { error?: string };
          if (!res.ok) {
            setErrors((prev) => ({ ...prev, [email]: data.error ?? "Could not send code." }));
            return;
          }
          setSent((prev) => ({ ...prev, [email]: true }));
        })
        .catch(() => {
          setErrors((prev) => ({ ...prev, [email]: "Could not send code." }));
        })
        .finally(() => {
          setSending((prev) => ({ ...prev, [email]: false }));
        });
    });
  }, [emails, eventId]);

  const handleVerify = async (email: string) => {
    const code = codes[email]?.trim() ?? "";
    setGlobalError("");
    setErrors((prev) => ({ ...prev, [email]: "" }));
    setVerifying((prev) => ({ ...prev, [email]: true }));

    try {
      const res = await fetch("/api/register/verify-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email, code }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [email]: data.error ?? "Verification failed." }));
        return;
      }
      setVerified((prev) => ({ ...prev, [email]: true }));
    } catch {
      setErrors((prev) => ({ ...prev, [email]: "Verification failed. Please try again." }));
    } finally {
      setVerifying((prev) => ({ ...prev, [email]: false }));
    }
  };

  const handleResend = async (email: string) => {
    setGlobalError("");
    setErrors((prev) => ({ ...prev, [email]: "" }));
    setSending((prev) => ({ ...prev, [email]: true }));

    try {
      const res = await fetch("/api/register/verify-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [email]: data.error ?? "Could not resend code." }));
        return;
      }
      setSent((prev) => ({ ...prev, [email]: true }));
      setVerified((prev) => ({ ...prev, [email]: false }));
      setCodes((prev) => ({ ...prev, [email]: "" }));
    } catch {
      setErrors((prev) => ({ ...prev, [email]: "Could not resend code." }));
    } finally {
      setSending((prev) => ({ ...prev, [email]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-dark rounded-xl p-5">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-2">
          Verify email addresses
        </h2>
        <p className="text-[13px] text-muted leading-relaxed">
          We sent a 6-digit code to each participant email for <strong className="text-light">{eventTitle}</strong>.
          Enter each code below before continuing to payment.
        </p>
        <p className="mt-2 text-[12px] text-muted leading-relaxed">
          In local development, Resend may only deliver to your Resend account email until your domain is verified.
        </p>
      </div>

      {globalError && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-[13px] text-red-300">
          {globalError}
        </div>
      )}

      {emails.map((email) => (
        <div
          key={email}
          className={cn(
            "bg-dark rounded-xl p-5 space-y-4",
            verified[email] && "ring-1 ring-primary/40"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted mb-1">
                Participant email
              </p>
              <p className="text-[14px] text-light break-all">{email}</p>
            </div>
            {verified[email] && (
              <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
                Verified
              </span>
            )}
          </div>

          {sending[email] && !sent[email] && (
            <p className="text-[12px] text-muted">Sending code…</p>
          )}

          {sent[email] && !verified[email] && (
            <>
              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">
                  6-digit code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={codes[email] ?? ""}
                  onChange={(e) =>
                    setCodes((prev) => ({
                      ...prev,
                      [email]: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  placeholder="000000"
                  className="w-full bg-dark-light border border-dark-border rounded-md px-4 py-3 text-[22px] text-light tracking-[0.5em] text-center placeholder:text-muted focus:border-primary focus:outline-none transition-colors font-headline font-black"
                />
              </div>

              {errors[email] && (
                <p className="font-headline text-[11px] font-medium text-red-400">{errors[email]}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleVerify(email)}
                  disabled={verifying[email] || (codes[email]?.length ?? 0) < 6}
                  className="flex-1 py-3 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest bg-primary text-dark hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                >
                  {verifying[email] ? "Verifying…" : "Verify email"}
                </button>
                <button
                  type="button"
                  onClick={() => handleResend(email)}
                  disabled={sending[email]}
                  className="py-3 px-4 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest border border-dark-border text-muted hover:border-primary hover:text-primary disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {sending[email] ? "Sending…" : "Resend"}
                </button>
              </div>
            </>
          )}

          {errors[email] && !sent[email] && !verified[email] && (
            <p className="font-headline text-[11px] font-medium text-red-400">{errors[email]}</p>
          )}
        </div>
      ))}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onBack}
          className="py-3 px-4 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest border border-dark-border text-muted hover:border-primary hover:text-primary transition-colors inline-flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to details
        </button>
        <button
          type="button"
          onClick={() => {
            if (!allVerified) {
              setGlobalError("Verify every participant email before continuing to payment.");
              return;
            }
            onComplete();
          }}
          disabled={!allVerified}
          className="flex-1 py-4 rounded-md font-headline text-[13px] font-bold uppercase tracking-widest bg-primary text-dark hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
        >
          Continue to payment <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
