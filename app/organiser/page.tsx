"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { signIn } from "aws-amplify/auth";

function SignInForm() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Sign in via Cognito — tokens are stored in Amplify cookies (ssr:true)
      const result = await signIn({ username: email, password });

      if (result.nextStep.signInStep !== "DONE") {
        // Handle edge cases: e.g. user must confirm email first
        if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
          router.push("/organiser/verify-email?email=" + encodeURIComponent(email));
          return;
        }
        setError("Additional verification required. Please contact support.");
        return;
      }

      // 2. Hit our session API to upsert the Prisma organiser record and get status
      const res  = await fetch("/api/organiser/auth/session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Sign in failed. Please try again."); return; }

      // 3. Redirect based on organiser application status
      const status: string = data.status;
      if (status === "APPROVED")        { router.push("/organiser/dashboard"); return; }
      if (status === "PENDING_PROFILE") { router.push("/organiser/onboarding"); return; }
      router.push("/organiser/pending");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("NotAuthorizedException") || msg.includes("Incorrect username or password")) {
        setError("Incorrect email or password.");
      } else if (msg.includes("UserNotConfirmedException")) {
        router.push("/organiser/verify-email?email=" + encodeURIComponent(email));
      } else if (msg.includes("UserNotFoundException")) {
        setError("No account found with that email.");
      } else {
        setError("Something went wrong. Please check your connection and try again.");
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
          <div className="flex items-center gap-2 mb-10">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" />
            <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary">
              Organiser Portal
            </span>
          </div>

          <h1 className="font-headline text-5xl sm:text-6xl font-black italic tracking-tighter leading-[0.9] mb-4">
            Welcome<br /><span className="text-primary">back.</span>
          </h1>
          <p className="text-muted text-[15px] leading-relaxed mb-10 max-w-sm">
            Manage your listings, track registrations and publish new events to
            Australia&apos;s fitness calendar.
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="events@yourorg.com.au"
                  className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">Password</label>
                <Link href="/organiser/forgot-password" className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-11 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Signing in…</> : <>Sign in to portal <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-8 text-center font-headline text-[12px] uppercase tracking-widest text-muted">
            New organiser?{" "}
            <Link href="/organiser/register" className="text-primary hover:underline">Apply for an account</Link>
          </p>
        </div>
      </section>

      {/* ── RIGHT — visual ── */}
      <section className="hidden lg:flex items-center justify-center relative overflow-hidden hero-topo">
        <div className="absolute top-8 left-8 w-6 h-6 hud-corner-tl" />
        <div className="absolute top-8 right-8 w-6 h-6 hud-corner-tr" />
        <div className="absolute bottom-8 left-8 w-6 h-6 hud-corner-bl" />
        <div className="absolute bottom-8 right-8 w-6 h-6 hud-corner-br" />
        <div className="absolute inset-0 scan-grid opacity-60" />
        <div className="relative z-10 text-center px-12">
          <Image src="/images/logo-title.svg" alt="Startline" width={200} height={50} className="h-12 w-auto mx-auto mb-10 opacity-90" />
          <div className="font-headline text-6xl font-black italic tracking-tighter leading-none text-light mb-6">
            Race day<br /><span className="text-primary">starts here.</span>
          </div>
          <p className="text-muted text-[15px] leading-relaxed max-w-sm mx-auto mb-10">
            Publish events, track registrations and reach thousands of athletes across Australia.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            {[{ v: "42K+", l: "Athletes" }, { v: "180+", l: "Events" }, { v: "8", l: "States" }].map(({ v, l }) => (
              <div key={l} className="bg-dark/40 border border-primary/20 rounded-lg p-4">
                <div className="font-headline text-2xl font-black italic tracking-tighter text-primary">{v}</div>
                <div className="font-headline text-[10px] uppercase tracking-widest text-muted mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function OrganiserSignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
