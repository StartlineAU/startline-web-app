"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const NATIVE_RETURN_URL = "com.startlineau.app://turnstile";

/**
 * Hosted bot-check hand-off for the native app.
 *
 * Turnstile only runs on the production host allowlist, so a React Native
 * screen cannot render the widget itself. The app opens this page in the system
 * browser; once Turnstile issues a token, this page returns it to the app using
 * the app's custom scheme. The token is short-lived and only proves the one
 * form request that follows it.
 */
export default function NativeChallengePage() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    const target = `${NATIVE_RETURN_URL}?token=${encodeURIComponent(token)}`;
    window.location.replace(target);
  }, [token]);

  return (
    <main className="min-h-screen bg-darker flex items-center justify-center px-5 py-12">
      <section className="w-full max-w-[430px] rounded-2xl border border-dark-lighter bg-dark p-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-5">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>

        <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-2">
          Security check
        </p>
        <h1 className="font-headline text-3xl font-bold italic tracking-[-0.04em] text-light leading-none mb-3">
          Confirm it&apos;s
          <br />
          <span className="text-primary">really you.</span>
        </h1>
        <p className="text-[13px] leading-relaxed text-muted mb-5">
          Startline is checking this registration before sending you back to the app.
          Nothing is charged or submitted on this page.
        </p>

        {!TURNSTILE_SITE_KEY ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-amber-200">
            Bot verification is not configured on this environment.
          </div>
        ) : token ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-[13px] text-primary">
            Check complete. Returning to Startline…
          </div>
        ) : (
          <div className="rounded-xl border border-dark-lighter bg-dark-light px-4 py-4">
            <TurnstileWidget
              key={attempt}
              siteKey={TURNSTILE_SITE_KEY}
              onTokenChange={(nextToken) => {
                if (nextToken) {
                  setError(false);
                  setToken(nextToken);
                }
              }}
              onError={() => setError(true)}
            />
            {error ? (
              <button
                type="button"
                onClick={() => {
                  setError(false);
                  setAttempt((value) => value + 1);
                }}
                className="mt-3 inline-flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-primary"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Try the check again
              </button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
