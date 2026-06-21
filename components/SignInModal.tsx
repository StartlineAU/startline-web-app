"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Mail, Lock, Eye, EyeOff, ArrowRight, User, Phone, ChevronDown } from "lucide-react";
import { signIn, signUp, signOut } from "aws-amplify/auth";
import { useAuthContext } from "@/context/AuthContext";

type View = "signin" | "signup" | "onboarding";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function calcAge(dobStr: string): number {
  const dob   = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const router      = useRouter();
  const { refresh } = useAuthContext();

  const [view,          setView]          = useState<View>("signin");
  const [email,         setEmail]         = useState("");
  const [firstName,     setFirstName]     = useState("");
  const [lastName,      setLastName]      = useState("");
  const [dobDay,        setDobDay]        = useState("");
  const [dobMonth,      setDobMonth]      = useState("");
  const [dobYear,       setDobYear]       = useState("");
  const [phone,         setPhone]         = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms,     setShowTerms]     = useState(false);
  const [showPrivacy,   setShowPrivacy]   = useState(false);
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [showPw,        setShowPw]        = useState(false);
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setView("signin");
      setEmail(""); setFirstName(""); setLastName("");
      setDobDay(""); setDobMonth(""); setDobYear(""); setPhone("");
      setAcceptedTerms(false); setShowTerms(false); setShowPrivacy(false);
      setPassword(""); setConfirm("");
      setError(""); setShowPw(false);
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Sign in ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signOut({ global: false }).catch(() => {});
      const result = await signIn({ username: email, password });

      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
        onClose(); router.push("/customer/verify-email?email=" + encodeURIComponent(email)); return;
      }
      if (result.nextStep.signInStep === "RESET_PASSWORD") {
        onClose(); router.push("/customer/forgot-password?email=" + encodeURIComponent(email)); return;
      }
      if (result.nextStep.signInStep !== "DONE") {
        setError("Additional verification required. Please contact support."); return;
      }

      await fetch("/api/customer/auth/session", { method: "POST" });

      try {
        const pendingName = sessionStorage.getItem("startline_pending_name");
        if (pendingName) {
          await fetch("/api/customer/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: pendingName }),
          });
          sessionStorage.removeItem("startline_pending_name");
          sessionStorage.removeItem("startline_pending_dob");
          sessionStorage.removeItem("startline_pending_phone");
        }
      } catch {}

      await refresh();
      onClose();
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name ?? "";
      const msg     = err instanceof Error ? err.message : "";
      if (errName === "NotAuthorizedException" || msg.includes("Incorrect username or password")) {
        setError("Incorrect email or password.");
      } else if (errName === "UserNotConfirmedException") {
        onClose(); router.push("/customer/verify-email?email=" + encodeURIComponent(email));
      } else if (errName === "UserNotFoundException") {
        setError("No account found with that email.");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Sign up step 1 ─────────────────────────────────────────────────────────
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    setFirstName(""); setLastName(""); setDobDay(""); setDobMonth(""); setDobYear(""); setPhone("");
    setAcceptedTerms(false); setShowTerms(false); setShowPrivacy(false);
    setView("onboarding");
  };

  // ── Onboarding step 2 ──────────────────────────────────────────────────────
  const handleContinueOnboarding = async () => {
    setError("");
    if (!firstName.trim()) { setError("Please enter your first name."); return; }
    if (!lastName.trim())  { setError("Please enter your last name."); return; }

    const day   = parseInt(dobDay,   10);
    const month = parseInt(dobMonth, 10);
    const year  = parseInt(dobYear,  10);
    if (!dobDay || !dobMonth || !dobYear || isNaN(day) || isNaN(month) || isNaN(year)) {
      setError("Please enter your date of birth."); return;
    }
    if (month < 1 || month > 12) { setError("Please enter a valid month (1-12)."); return; }
    if (day < 1 || day > 31)     { setError("Please enter a valid day (1-31)."); return; }
    if (year < 1900 || year > new Date().getFullYear()) { setError("Please enter a valid year."); return; }

    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const testDate = new Date(isoDate + "T00:00:00");
    if (isNaN(testDate.getTime()) || testDate.getDate() !== day) {
      setError("Please enter a valid date of birth."); return;
    }

    const age = calcAge(isoDate);
    if (age < 13)  { setError("You must be at least 13 years old to create an account."); return; }
    if (age > 120) { setError("Please enter a valid date of birth."); return; }

    if (!phone.trim()) { setError("Please enter your phone number."); return; }
    if (!acceptedTerms) { setError("You must accept the Terms & Conditions and Privacy Policy to continue."); return; }

    // Normalise to E.164 — accept 04xx, 03xx, +61, 61 formats
    const rawPhone    = phone.trim().replace(/[\s\-()]/g, "");
    const e164Phone   = rawPhone.startsWith("0")
      ? "+61" + rawPhone.slice(1)
      : rawPhone.startsWith("61")
        ? "+" + rawPhone
        : rawPhone.startsWith("+")
          ? rawPhone
          : "+61" + rawPhone;

    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name:         fullName,
            phone_number: e164Phone,
            birthdate:    isoDate,
          },
        },
      });
      try {
        sessionStorage.setItem("startline_pending_name",  fullName);
        sessionStorage.setItem("startline_pending_dob",   isoDate);
        sessionStorage.setItem("startline_pending_phone", e164Phone);
      } catch {}
      onClose();
      router.push("/customer/verify-email?email=" + encodeURIComponent(email));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UsernameExistsException")) {
        setError("An account with that email already exists.");
      } else if (msg.includes("InvalidPasswordException")) {
        setError("Password must be at least 8 characters with upper, lower and a number.");
      } else {
        setError(msg || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchView = (v: "signin" | "signup") => {
    setView(v); setError(""); setPassword(""); setConfirm("");
  };

  const dobDayRef   = useRef<HTMLInputElement>(null);
  const dobMonthRef = useRef<HTMLInputElement>(null);
  const dobYearRef  = useRef<HTMLInputElement>(null);

  if (!isOpen || typeof document === "undefined") return null;

  const inputCls    = "w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";
  const dobInputCls = "w-full bg-dark border border-dark-lighter rounded-md px-3 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors text-center";
  const labelCls    = "font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1";
  const btnCls      = "bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-3 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed";
  const errCls      = "mb-3 px-3 py-2.5 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[440px] bg-dark-darker border border-dark-lighter rounded-2xl p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">

        {/* Header */}
        {view !== "onboarding" ? (
          <div className="flex items-center gap-2 mb-6">
            <div className="flex flex-1 gap-1 p-1 bg-dark rounded-lg">
              {(["signin", "signup"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={`flex-1 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest transition-all ${
                    view === v ? "bg-primary text-dark" : "text-muted hover:text-light"
                  }`}
                >
                  {v === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="flex-shrink-0 text-muted hover:text-primary transition-colors p-1" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-primary transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ── Sign In ── */}
        {view === "signin" && (
          <>
            <div className="mb-6">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">Customer Portal</span>
              <h2 className="font-headline text-5xl font-black italic tracking-tighter leading-[0.9] mb-3">
                Welcome<br /><span className="text-primary">back.</span>
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">Sign in to track your events, saved races and registrations.</p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">Password</label>
                  <Link href="/customer/forgot-password" onClick={onClose} className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">Forgot?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" className={inputCls + " pr-11"} />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Signing in…</> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        )}

        {/* ── Sign Up ── */}
        {view === "signup" && (
          <>
            <div className="mb-4">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">Customer Portal</span>
              <h2 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] mb-2">
                Join<br /><span className="text-primary">Startline.</span>
              </h2>
              <p className="text-muted text-[13px] leading-snug">Free account to save events and track registrations.</p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={inputCls + " pr-11"} />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPw ? "text" : "password"} required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" className={inputCls} />
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Creating account…</> : <>Create account <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        )}

        {/* ── Onboarding ── */}
        {view === "onboarding" && (
          <>
            <div className="mb-5 pt-2">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-2">Account Creation</span>
              <h2 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] mb-2">
                Welcome to<br /><span className="text-primary">Startline.</span>
              </h2>
              <p className="text-muted text-[13px] leading-snug">Tell us a bit about yourself to get started.</p>
            </div>

            {error && <div className={errCls}>{error}</div>}

            <div className="space-y-3">
              {/* First / Last name */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input autoFocus type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Date of birth — three text inputs */}
              <div>
                <label className={labelCls}>Date of Birth</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input
                      ref={dobDayRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={dobDay}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setDobDay(v);
                        if (v.length === 2) dobMonthRef.current?.focus();
                      }}
                      placeholder="DD"
                      className={dobInputCls}
                    />
                  </div>
                  <div>
                    <input
                      ref={dobMonthRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={dobMonth}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setDobMonth(v);
                        if (v.length === 2) dobYearRef.current?.focus();
                      }}
                      placeholder="MM"
                      className={dobInputCls}
                    />
                  </div>
                  <div>
                    <input
                      ref={dobYearRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={dobYear}
                      onChange={(e) => setDobYear(e.target.value.replace(/\D/g, ""))}
                      placeholder="YYYY"
                      className={dobInputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className={labelCls}>Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61 400 000 000" className={inputCls} />
                </div>
              </div>

              {/* T&C */}
              <div className="pt-1 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="sr-only" />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      acceptedTerms ? "bg-primary border-primary" : "border-dark-lighter bg-dark group-hover:border-primary/50"
                    }`}>
                      {acceptedTerms && (
                        <svg className="w-3 h-3 text-dark" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="font-headline text-[11px] uppercase tracking-widest text-muted leading-relaxed">
                    I agree to the{" "}
                    <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(s => !s); setShowPrivacy(false); }} className="text-primary hover:underline">
                      Terms &amp; Conditions
                    </button>
                    {" "}and{" "}
                    <button type="button" onClick={(e) => { e.preventDefault(); setShowPrivacy(s => !s); setShowTerms(false); }} className="text-primary hover:underline">
                      Privacy Policy
                    </button>
                  </span>
                </label>

                {showTerms && (
                  <div className="rounded-lg border border-dark-lighter bg-dark overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-lighter">
                      <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Terms &amp; Conditions</span>
                      <button type="button" onClick={() => setShowTerms(false)}><ChevronDown className="w-4 h-4 text-muted rotate-180" /></button>
                    </div>
                    <div className="px-4 py-3 max-h-36 overflow-y-auto text-muted text-[12px] leading-relaxed space-y-2">
                      <p>Terms and Conditions content coming soon.</p>
                      <p>By creating an account you agree to use this platform in accordance with our guidelines and applicable laws.</p>
                    </div>
                  </div>
                )}

                {showPrivacy && (
                  <div className="rounded-lg border border-dark-lighter bg-dark overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-lighter">
                      <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">Privacy Policy</span>
                      <button type="button" onClick={() => setShowPrivacy(false)}><ChevronDown className="w-4 h-4 text-muted rotate-180" /></button>
                    </div>
                    <div className="px-4 py-3 max-h-36 overflow-y-auto text-muted text-[12px] leading-relaxed space-y-2">
                      <p>Privacy Policy content coming soon.</p>
                      <p>We are committed to protecting your personal information and will only use your data in accordance with applicable privacy legislation.</p>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleContinueOnboarding} disabled={loading} className={btnCls}>
                {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Creating account…</> : <>Get started <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </>
        )}


      </div>
    </div>,
    document.body
  );
}
