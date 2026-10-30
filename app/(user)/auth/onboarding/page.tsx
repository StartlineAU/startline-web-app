"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, User } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { customerHref } from "@/lib/portal-domains";
import { usePortalHost } from "@/lib/use-portal-host";
import { calcAge, MIN_AGE } from "@/lib/age";
import { validateUsername } from "@/lib/username-validation";

// First sign-in through Google or Apple lands here. The modal's sign-up flow
// asks for these before it creates the account; a provider sign-up never saw
// that step, so without this the age gate and terms are simply skipped.

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth/")) return "/";
  return value;
}

function OnboardingForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { refresh }  = useAuthContext();
  const host         = usePortalHost();
  const returnTo     = safeReturnTo(searchParams.get("returnTo"));

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [dobDay,    setDobDay]    = useState("");
  const [dobMonth,  setDobMonth]  = useState("");
  const [dobYear,   setDobYear]   = useState("");
  const [username,  setUsername]  = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [error,   setError]   = useState("");

  // Prefill what the provider did give us: Apple sends a name only on the very
  // first consent, so it is often missing.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/profile")
      .then((r) => {
        if (r.status === 401) { if (!cancelled) setSignedOut(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((profile) => {
        if (cancelled || !profile) return;
        const [first = "", ...rest] = String(profile.name ?? "").split(" ");
        setFirstName(first);
        setLastName(rest.join(" "));
        setUsername(profile.username ?? "");
        if (typeof profile.dateOfBirth === "string") {
          const [y, m, d] = profile.dateOfBirth.split("-");
          setDobYear(y ?? ""); setDobMonth(m ?? ""); setDobDay(d ?? "");
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) { setError("Please enter your first and last name."); return; }

    const isoDate = `${dobYear}-${String(dobMonth).padStart(2, "0")}-${String(dobDay).padStart(2, "0")}`;
    if (!dobDay || !dobMonth || !dobYear) { setError("Please enter your date of birth."); return; }
    const age = calcAge(isoDate);
    if (age === null) { setError("Please enter a valid date of birth."); return; }
    if (age < MIN_AGE) { setError(`You must be ${MIN_AGE} or older to create an account.`); return; }
    if (!acceptedTerms) { setError("You must accept the Terms & Conditions and Privacy Policy to continue."); return; }

    const handle = username.trim().toLowerCase();
    if (handle) {
      const validation = validateUsername(handle);
      if (!validation.valid) { setError(validation.reason); return; }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`,
          dateOfBirth: isoDate,
          ...(handle ? { username: handle } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Could not save your details. Please try again.");
        return;
      }
      await refresh();
      // Full load so the server sees the updated account on the next page.
      window.location.replace(returnTo);
    } catch {
      setError("Could not save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const labelCls = "font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2";
  const inputCls = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[15px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors";
  const dobCls   = inputCls + " text-center";
  const btnCls   = "w-full bg-machined shadow-machined text-dark font-headline text-sm font-bold uppercase tracking-widest py-3 rounded-md flex items-center justify-center gap-2 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[480px] page-in">
        <Link href="/">
          <Image src="/images/logo-title.svg" alt="Startline" width={160} height={40} className="h-10 w-auto mx-auto mb-10 opacity-80" />
        </Link>

        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 text-center">
          One last step
        </div>
        <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-3 text-center">
          Finish your<br /><span className="text-primary">profile.</span>
        </h1>
        <p className="text-muted text-[15px] leading-relaxed mb-8 text-center">
          Google and Apple don&apos;t share these, and we need them before you can enter events.
        </p>

        {error && (
          <p role="alert" className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-muted font-headline text-[12px] uppercase tracking-widest">Loading…</p>
        ) : signedOut ? (
          <div className="text-center space-y-4">
            <p className="text-muted text-[15px]">Please sign in to finish setting up your account.</p>
            <Link href="/" className="inline-block font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:underline">
              Back to Startline
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="onb-first" className={labelCls}>First name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input id="onb-first" autoFocus required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" className={inputCls + " pl-10"} />
                </div>
              </div>
              <div>
                <label htmlFor="onb-last" className={labelCls}>Last name</label>
                <input id="onb-last" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" className={inputCls} />
              </div>
            </div>

            <div>
              <span id="onb-dob-label" className={labelCls}>Date of birth</span>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="onb-dob-label">
                <input aria-label="Day"   inputMode="numeric" maxLength={2} placeholder="DD" value={dobDay}
                  onChange={(e) => setDobDay(e.target.value.replace(/\D/g, ""))} className={dobCls} />
                <input aria-label="Month" inputMode="numeric" maxLength={2} placeholder="MM" value={dobMonth}
                  onChange={(e) => setDobMonth(e.target.value.replace(/\D/g, ""))} className={dobCls} />
                <input aria-label="Year"  inputMode="numeric" maxLength={4} placeholder="YYYY" value={dobYear}
                  onChange={(e) => setDobYear(e.target.value.replace(/\D/g, ""))} className={dobCls} />
              </div>
            </div>

            <div>
              <label htmlFor="onb-username" className={labelCls}>Username <span className="normal-case tracking-normal">(optional)</span></label>
              <input id="onb-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your-handle" className={inputCls} />
            </div>

            <label className="flex items-start gap-3 cursor-pointer group pt-1">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="sr-only" />
              <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${acceptedTerms ? "bg-primary border-primary text-dark" : "border-dark-lighter bg-dark"}`}>
                {acceptedTerms && <Check className="w-3 h-3" />}
              </span>
              <span className="font-headline text-[11px] uppercase tracking-widest text-muted leading-relaxed">
                I agree to the{" "}
                <a href={customerHref("/terms", host)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
                {" "}and the{" "}
                <a href={customerHref("/privacy", host)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>
              </span>
            </label>

            <button type="submit" disabled={saving} className={btnCls}>
              {saving ? "Saving…" : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingForm />
    </Suspense>
  );
}
