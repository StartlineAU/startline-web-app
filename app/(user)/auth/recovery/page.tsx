"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, KeyRound, Lock, Mail, ShieldAlert } from "lucide-react";

function RecoveryForm() {
  const searchParams = useSearchParams();
  const [email,    setEmail]    = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [code,     setCode]     = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not reset the authenticator app. Please try again.");
        return;
      }
      setPassword("");
      setCode("");
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-3 text-[15px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none transition-colors";
  const labelCls = "font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2";

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="w-full max-w-[440px] page-in">
        <Link href="/">
          <Image src="/images/logo-title.svg" alt="Startline" width={160} height={40} className="h-10 w-auto mx-auto mb-12 opacity-80" />
        </Link>

        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>

        {done ? (
          <>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 text-center">
              Recovered
            </div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4 text-center">
              Authenticator<br /><span className="text-primary">turned off.</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-8 text-center">
              Sign in with your password, then set the authenticator app up again under
              Settings → Login &amp; security. You have fewer recovery codes left.
            </p>
            <Link
              href="/"
              className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
            >
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        ) : (
          <>
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-4 text-center">
              Account recovery
            </div>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-4 text-center">
              Lost your<br /><span className="text-primary">authenticator?</span>
            </h1>
            <p className="text-muted text-[15px] leading-relaxed mb-8 text-center">
              Enter your password and one of the recovery codes you saved when you set up the
              app. This turns the app off so you can sign in and set it up again.
            </p>

            {error && (
              <div role="alert" className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor="recovery-email" className={labelCls}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input
                    id="recovery-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="recovery-password" className={labelCls}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input
                    id="recovery-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="recovery-code" className={labelCls}>Recovery code</label>
                <div className="relative">
                  <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input
                    id="recovery-code"
                    type="text"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="XXXXX-XXXXX"
                    className={`${inputCls} tracking-[0.2em] font-mono`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email || !password || code.trim().length < 4}
                className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Checking…</>
                  : <>Turn off authenticator <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <p className="text-muted text-[12px] leading-relaxed mt-6 text-center">
              Each code works once. No codes left, or never saved them?{" "}
              <Link href="/contact" className="text-primary hover:underline">Contact support</Link>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function RecoveryPage() {
  return (
    <Suspense fallback={null}>
      <RecoveryForm />
    </Suspense>
  );
}
