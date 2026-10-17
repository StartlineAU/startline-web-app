"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAuthContext } from "@/context/AuthContext";
import {
  planSocialCallback,
  socialSignInErrorMessage,
  startSocialSignIn,
} from "@/lib/social-sign-in";

// Development runs effects twice. A second pass would find the retry already
// claimed and show an error while the first is still redirecting. A full page
// load is a fresh module, so this never needs resetting.
let started = false;

export default function SocialCallback({ failure }: { failure: string | null }) {
  const { refresh } = useAuthContext();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started) return;
    started = true;

    (async () => {
      const plan = planSocialCallback(failure);

      if (plan.kind === "retry") {
        // The first sign-in after the pre sign-up trigger links a provider to
        // an existing account always fails this way; the same sign-in a second
        // time goes through as the linked user.
        await startSocialSignIn(plan.provider, plan.returnTo);
        return;
      }
      if (plan.kind === "error") {
        setError(plan.message);
        return;
      }

      try {
        // Waits for the code exchange the OAuth listener started.
        const session = await fetchAuthSession();
        if (!session.tokens?.accessToken) throw new Error("No session");
        // Registers the Prisma row the way the password flow does, so the
        // account exists whichever page they land on next.
        await fetch("/api/user/auth/session", { method: "POST" });
        await refresh();
        // A full load, so the server sees the new cookies on the next page.
        window.location.replace(plan.returnTo);
      } catch {
        setError(socialSignInErrorMessage(""));
      }
    })();
  }, [failure, refresh]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-[440px] text-center">
        {error ? (
          <>
            <span className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary block mb-2">Sign In</span>
            <h1 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] mb-4">
              Sign-in <span className="text-primary">failed.</span>
            </h1>
            <p role="alert" className="text-muted text-[14px] leading-relaxed mb-6">{error}</p>
            <Link
              href="/"
              className="inline-block font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors"
            >
              Back to Startline
            </Link>
          </>
        ) : (
          <p className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" /> Signing you in…
          </p>
        )}
      </div>
    </div>
  );
}
