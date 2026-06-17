"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Mail, Lock, Eye, EyeOff, ArrowRight, User } from "lucide-react";
import { signIn, signUp, signOut } from "aws-amplify/auth";
import { useAuthContext } from "@/context/AuthContext";

type View = "signin" | "signup";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const router   = useRouter();
  const { refresh } = useAuthContext();

  const [view,     setView]     = useState<View>("signin");
  const [email,    setEmail]    = useState("");
  const [name,     setName]     = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll + reset form state when toggled
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setView("signin");
      setEmail(""); setName(""); setPassword(""); setConfirm("");
      setError(""); setShowPw(false);
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Sign in ──────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signOut({ global: false }).catch(() => {});
      const result = await signIn({ username: email, password });

      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
        onClose();
        router.push("/athlete/verify-email?email=" + encodeURIComponent(email));
        return;
      }
      if (result.nextStep.signInStep === "RESET_PASSWORD") {
        onClose();
        router.push("/athlete/forgot-password?email=" + encodeURIComponent(email));
        return;
      }
      if (result.nextStep.signInStep !== "DONE") {
        setError("Additional verification required. Please contact support.");
        return;
      }

      await fetch("/api/athlete/auth/session", { method: "POST" });
      await refresh();
      onClose();
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? "";
      const msg  = err instanceof Error ? err.message : "";
      if (name === "NotAuthorizedException" || msg.includes("Incorrect username or password")) {
        setError("Incorrect email or password.");
      } else if (name === "UserNotConfirmedException") {
        onClose();
        router.push("/athlete/verify-email?email=" + encodeURIComponent(email));
      } else if (name === "UserNotFoundException") {
        setError("No account found with that email.");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Sign up ──────────────────────────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            ...(name.trim() ? { name: name.trim() } : {}),
          },
        },
      });
      onClose();
      router.push("/athlete/verify-email?email=" + encodeURIComponent(email));
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

  const switchView = (v: View) => {
    setView(v);
    setError("");
    setPassword(""); setConfirm("");
  };

  if (!isOpen || typeof document === "undefined") return null;

  const inputCls = "w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";
  const labelCls = "font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2";
  const btnCls   = "bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[440px] bg-dark-darker border border-dark-lighter rounded-2xl p-8 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">

        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-primary transition-colors" aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-dark rounded-lg mb-8">
          {(["signin", "signup"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`flex-1 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest transition-all ${
                view === v
                  ? "bg-primary text-dark"
                  : "text-muted hover:text-light"
              }`}
            >
              {v === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* ── Sign In view ── */}
        {view === "signin" && (
          <>
            <div className="mb-8">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-3">
                Athlete Portal
              </span>
              <h2 className="font-headline text-5xl font-black italic tracking-tighter leading-[0.9] mb-3">
                Welcome<br /><span className="text-primary">back.</span>
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">
                Sign in to track your events, saved races and registrations.
              </p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className={inputCls} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls.replace("block mb-2", "")}>Password</label>
                  <Link href="/athlete/forgot-password" onClick={onClose}
                    className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••" className={inputCls + " pr-11"} />
                  <button type="button" onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className={btnCls}>
                {loading
                  ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Signing in…</>
                  : <>Sign in <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        )}

        {/* ── Sign Up view ── */}
        {view === "signup" && (
          <>
            <div className="mb-8">
              <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-3">
                Athlete Portal
              </span>
              <h2 className="font-headline text-5xl font-black italic tracking-tighter leading-[0.9] mb-3">
                Join<br /><span className="text-primary">Startline.</span>
              </h2>
              <p className="text-muted text-[14px] leading-relaxed">
                Create a free account to save events and track your registrations.
              </p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
                {error}
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <label className={labelCls}>Name <span className="normal-case tracking-normal font-normal text-muted-dark">(optional)</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Your name" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters" className={inputCls + " pr-11"} />
                  <button type="button" onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPw ? "text" : "password"} required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password" className={inputCls} />
                </div>
              </div>

              <button type="submit" disabled={loading} className={btnCls}>
                {loading
                  ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Creating account…</>
                  : <>Create account <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </>
        )}

        {/* Divider + organiser link */}
        <div className="mt-6 pt-6 border-t border-dark-lighter text-center">
          <p className="font-headline text-[12px] uppercase tracking-widest text-muted">
            Organiser?{" "}
            <Link href="/organiser" onClick={onClose} className="text-primary hover:underline">
              Organisers sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
