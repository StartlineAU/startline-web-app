"use client";

import { useState } from "react";
import Link from "next/link";
import { enabledSocialProviders, startSocialSignIn, type SocialProvider } from "@/lib/social-sign-in";

// Provider marks are the one exception to "Lucide icons only": Google and
// Apple both require their own logo, unaltered, on a sign-in button.
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="w-[18px] h-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 17 20" className="w-[16px] h-[19px]" aria-hidden="true" fill="currentColor">
      <path d="M14.04 10.63c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79A4.43 4.43 0 0 0 2.46 7.7C.88 10.45 2.05 14.5 3.6 16.73c.75 1.09 1.64 2.31 2.81 2.27 1.13-.05 1.55-.73 2.92-.73 1.36 0 1.75.73 2.94.71 1.21-.02 1.98-1.1 2.72-2.2a9.8 9.8 0 0 0 1.23-2.53 3.94 3.94 0 0 1-2.18-3.62zM11.8 3.87A3.9 3.9 0 0 0 12.72 1a4 4 0 0 0-2.6 1.34 3.74 3.74 0 0 0-.94 2.77 3.3 3.3 0 0 0 2.62-1.24z" />
    </svg>
  );
}

const LABELS: Record<SocialProvider, string> = {
  google: "Continue with Google",
  apple:  "Continue with Apple",
};

type Props = {
  termsHref:   string;
  privacyHref: string;
  // Where to land after signing in. Defaults to the current page.
  returnTo?: string;
};

// Renders nothing when this deployment has no social providers, so callers can
// drop it in unconditionally.
export default function SocialSignInButtons({ termsHref, privacyHref, returnTo }: Props) {
  const providers = enabledSocialProviders();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error,   setError]   = useState("");

  if (providers.length === 0) return null;

  const start = async (provider: SocialProvider) => {
    setError("");
    setPending(provider);
    try {
      await startSocialSignIn(provider, returnTo);
    } catch {
      setPending(null);
      setError("We couldn't reach the sign-in service. Please try again.");
    }
  };

  const btnCls = "w-full bg-dark border border-dark-lighter rounded-md py-3 flex items-center justify-center gap-3 text-light font-headline text-[13px] font-bold uppercase tracking-widest hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-3">
      {error && (
        <div className="px-3 py-2.5 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>
      )}
      {providers.map((p) => (
        <button key={p} type="button" onClick={() => start(p)} disabled={pending !== null} className={btnCls}>
          {p === "google" ? <GoogleMark /> : <AppleMark />}
          {pending === p ? "Redirecting…" : LABELS[p]}
        </button>
      ))}
      {/* A first sign-in here creates the account, skipping the onboarding
          step where the email form has the terms ticked. */}
      <p className="text-muted text-[12px] leading-snug">
        By continuing with Google or Apple you agree to the{" "}
        <Link href={termsHref} className="text-light underline hover:text-primary">Terms &amp; Conditions</Link>{" "}
        and{" "}
        <Link href={privacyHref} className="text-light underline hover:text-primary">Privacy Policy</Link>.
      </p>
      <div className="flex items-center gap-3 pt-1" aria-hidden="true">
        <span className="h-px flex-1 bg-dark-lighter" />
        <span className="font-headline text-[11px] uppercase tracking-widest text-muted">or use email</span>
        <span className="h-px flex-1 bg-dark-lighter" />
      </div>
    </div>
  );
}
