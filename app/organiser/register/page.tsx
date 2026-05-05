"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, User } from "lucide-react";
import { signUp } from "aws-amplify/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      // Cognito creates the user and sends a 6-digit verification code by email
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email },
        },
      });

      // Redirect to code-entry page, passing email so it can pre-fill
      router.push("/organiser/verify-email?email=" + encodeURIComponent(email));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("signUp error:", err);
      if (msg.includes("UsernameExistsException")) {
        setError("An account with that email already exists.");
      } else if (msg.includes("InvalidPasswordException")) {
        setError("Password does not meet requirements (min 8 characters, upper, lower, number).");
      } else {
        setError(msg || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* ── LEFT — form ── */}
      <section className="flex items-center justify-center px-6 py-16 lg:py-24 bg-dark-darker">
        <div className="w-full max-w-[440px]">
          <Link href="/organiser" className="flex items-center gap-2 mb-10 text-muted hover:text-primary transition-colors w-fit">
            <Image src="/images/logo-title.svg" alt="Startline" width={120} height={30} className="h-7 w-auto opacity-70 hover:opacity-100 transition-opacity" />
          </Link>

          <div className="flex items-center gap-2 mb-6">
            <User className="w-4 h-4 text-primary" />
            <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary">
              Create organiser account
            </span>
          </div>

          <h1 className="font-headline text-4xl sm:text-5xl font-black italic tracking-tighter leading-[0.9] mb-3">
            Apply to<br /><span className="text-primary">list events.</span>
          </h1>
          <p className="text-muted text-[14px] leading-relaxed mb-8">
            Create your account, verify your email, complete your organiser profile and submit for review. Approval typically takes 1–2 business days.
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="events@yourorg.com.au"
                  className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
              </div>
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-11 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input type={showPw ? "text" : "password"} required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Creating account…</> : <>Create account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-8 text-center font-headline text-[12px] uppercase tracking-widest text-muted">
            Already have an account?{" "}
            <Link href="/organiser" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </section>

      {/* ── RIGHT — steps overview ── */}
      <section className="hidden lg:flex items-center justify-center relative overflow-hidden hero-topo px-12">
        <div className="absolute inset-0 scan-grid opacity-40" />
        <div className="relative z-10 max-w-sm">
          <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-6">
            Application process
          </div>
          <div className="space-y-6">
            {[
              { n: "01", title: "Create account",      desc: "Email + password. Takes 30 seconds." },
              { n: "02", title: "Verify email",         desc: "Enter the 6-digit code we send to your inbox." },
              { n: "03", title: "Complete profile",     desc: "Organisation details, ABN, insurance and past event evidence." },
              { n: "04", title: "Submit for review",    desc: "Our team reviews applications within 1–2 business days." },
              { n: "05", title: "Start listing events", desc: "Publish events and reach thousands of athletes." },
            ].map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className={`w-8 h-8 rounded-md border flex items-center justify-center font-headline font-black italic text-[13px] flex-shrink-0 ${i === 0 ? "bg-primary text-dark border-primary" : "bg-dark border-dark-lighter text-muted-dark"}`}>
                  {step.n}
                </div>
                <div>
                  <div className="font-headline text-[13px] font-bold uppercase tracking-tight text-light">{step.title}</div>
                  <div className="font-headline text-[11px] uppercase tracking-widest text-muted mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
