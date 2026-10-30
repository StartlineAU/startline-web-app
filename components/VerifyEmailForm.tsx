"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Mail, ArrowRight, RotateCcw, Check } from "lucide-react";
import { confirmSignUp, resendSignUpCode, autoSignIn } from "aws-amplify/auth";
import { useAuthContext } from "@/context/AuthContext";

interface VerifyEmailConfig {
  logoHref: string;
  sessionEndpoint: string;
  redirectPath: string;
  emailPlaceholder: string;
  inputIdPrefix: string;
  verifiedSubtext: string;
  submitButtonLabel: string;
  bottomLinkText: string;
  bottomLinkHref: string;
  bottomLinkLabel: string;
}

interface Props {
  config: VerifyEmailConfig;
  onVerified?: () => Promise<void>;
}

function VerifyEmailFormInner({ config, onVerified }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const { refresh } = useAuthContext();

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code.trim() });

      try {
        const result = await autoSignIn();
        if (result.nextStep.signInStep === "DONE") {
          await fetch(config.sessionEndpoint, { method: "POST" });
          await onVerified?.();
          await refresh();
          setVerified(true);
          setLoading(false);
          setTimeout(() => router.push(config.redirectPath), 1400);
          return;
        }
      } catch {}

      router.push(config.bottomLinkHref + "?verified=1");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("CodeMismatchException")) {
        setError("That code is incorrect. Please check and try again.");
      } else if (msg.includes("ExpiredCodeException")) {
        setError("That code has expired. Use the resend button below.");
      } else if (msg.includes("AliasExistsException")) {
        setError("This email is already verified. Try signing in.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) { setError("Enter your email address first."); return; }
    setError(""); setSuccess("");
    setResending(true);
    try {
      await resendSignUpCode({ username: email });
      setSuccess("A new code has been sent. Check your inbox and spam folder — look for an email from Amazon Cognito or no-reply@verificationemail.com.");
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name ?? "";
      const msg = err instanceof Error ? err.message : "";
      if (errName === "LimitExceededException" || msg.includes("LimitExceededException")) {
        setError("Too many attempts. Wait a few minutes, then try resend again.");
      } else if (errName === "InvalidParameterException" || msg.includes("User is already confirmed")) {
        setError("This email is already verified. Try signing in instead.");
      } else if (errName === "UserNotFoundException") {
        setError("No account found for that email. Sign up again or check the address is correct.");
      } else {
        setError(msg || "Could not resend the code. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="w-full max-w-[480px] page-in">
        <Link href={config.logoHref}>
          <Image src="/images/logo-title.svg" alt="Startline" width={160} height={40} className="h-10 w-auto mx-auto mb-12 opacity-80" />
        </Link>

        {verified ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
              <Check className="w-7 h-7 text-green-400" />
            </div>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 text-center">
              You&apos;re all set
            </div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4 text-center">
              Verified &amp;<br /><span className="text-primary">signed in.</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed text-center">
              {config.verifiedSubtext}
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-7 h-7 text-primary" />
            </div>

            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 text-center">
              Verify your email
            </div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4 text-center">
              Enter your<br /><span className="text-primary">6-digit code.</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-4 text-center">
              We sent a verification code to{" "}
              {email ? <strong className="text-light">{email}</strong> : "your email"}.
              Enter it below to activate your account.
            </p>
            <p className="text-muted text-[12px] leading-relaxed mb-8 text-center">
              This code is sent by AWS Cognito (not Resend). Check spam/junk, and allow a minute or two for delivery.
            </p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-5 px-4 py-3 rounded-md bg-green-900/20 border border-green-500/30 text-green-400 font-headline text-[13px]">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!emailParam && (
                <div>
                  <label htmlFor={`${config.inputIdPrefix}-email-input`} className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Email address</label>
                  <input id={`${config.inputIdPrefix}-email-input`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder={config.emailPlaceholder}
                    className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[15px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors" />
                </div>
              )}

              <div>
                <label htmlFor={`${config.inputIdPrefix}-code-input`} className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Verification code</label>
                <input
                  id={`${config.inputIdPrefix}-code-input`}
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[22px] text-light tracking-[0.5em] text-center placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors font-headline font-black"
                />
              </div>

              <button type="submit" disabled={loading || code.length < 6}
                className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Verifying…</> : <>{config.submitButtonLabel} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button onClick={handleResend} disabled={resending}
                className="inline-flex items-center gap-2 font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary transition-colors disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" />
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>

            <p className="mt-4 text-center font-headline text-[12px] uppercase tracking-widest text-muted">
              {config.bottomLinkText}{" "}
              <Link href={config.bottomLinkHref} className="text-primary hover:underline">{config.bottomLinkLabel}</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailForm(props: Props) {
  return (
    <Suspense>
      <VerifyEmailFormInner {...props} />
    </Suspense>
  );
}
