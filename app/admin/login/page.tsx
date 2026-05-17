"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { signIn, signOut, fetchAuthSession } from "aws-amplify/auth";

export default function AdminLoginPage() {
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
      await signOut({ global: false }).catch(() => {});

      const result = await signIn({ username: email, password });

      if (result.nextStep.signInStep !== "DONE") {
        setError("Additional verification required. Please contact support.");
        return;
      }

      // Check Cognito group membership
      const session = await fetchAuthSession();
      const groups =
        (session.tokens?.accessToken?.payload?.["cognito:groups"] as string[] | undefined) ?? [];

      if (!groups.includes("admin-nonprod-users")) {
        await signOut({ global: false }).catch(() => {});
        setError("Your account does not have admin access.");
        return;
      }

      // Register admin DB record on first login
      await fetch("/api/admin/auth/session", { method: "POST" }).catch(() => {});

      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? "";
      const msg  = err instanceof Error ? err.message : "";
      if (name === "NotAuthorizedException" || msg.includes("Incorrect username or password")) {
        setError("Incorrect email or password.");
      } else if (name === "UserNotFoundException") {
        setError("No account found with that email.");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-dark-darker px-6">
      <div className="w-full max-w-[400px]">
        <span className="font-headline text-[11px] font-medium uppercase tracking-[0.25em] text-primary block mb-8">
          Admin Portal
        </span>

        <h1 className="font-headline text-5xl font-black italic tracking-tighter leading-[0.9] mb-4">
          Admin<br /><span className="text-primary">sign in.</span>
        </h1>
        <p className="text-muted text-[15px] leading-relaxed mb-10">
          Access is restricted to members of the admin-nonprod-users group in Cognito.
        </p>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@startlineau.com"
                className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
              <input
                type={showPw ? "text" : "password"} required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full bg-dark border border-dark-lighter rounded-md pl-10 pr-11 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors"
              />
              <button
                type="button" onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-primary transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="bg-machined shadow-machined w-full text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 rounded-md flex items-center justify-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <><span className="w-2 h-2 bg-dark rounded-full animate-pulse-dot" /> Signing in…</>
              : <>Sign in <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </main>
  );
}
