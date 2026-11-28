"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Medal, TriangleAlert } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { formatShortDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type ClaimSummary = {
  registrationId: string;
  athleteName: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  place: string;
};

// Signing in strips the query string (NavBar replaces the URL once it has read
// ?signin=true), so the token waits here and the page reloads with it.
const PENDING_KEY = "startline_pending_claim";

function readPending(): string | null {
  try { return sessionStorage.getItem(PENDING_KEY); } catch { return null; }
}
function writePending(token: string | null) {
  try {
    if (token) sessionStorage.setItem(PENDING_KEY, token);
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {}
}

const shell = "min-h-screen bg-dark-darker flex items-center justify-center pt-20 pb-12";
const cta =
  "bg-machined shadow-machined inline-flex items-center gap-2 text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 px-8 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-60";

export default function ClaimRaceClient({ token, summary }: { token: string | null; summary: ClaimSummary | null }) {
  const router = useRouter();
  const { status } = useAuthContext();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [noToken, setNoToken] = useState(false);

  // Back from signing in without the token in the URL: put it back. With
  // nothing to put back, say the link is not valid rather than wait forever.
  useEffect(() => {
    if (token) {
      // A link that turned out not to be valid is not worth coming back to.
      if (!summary) writePending(null);
      return;
    }
    const pending = readPending();
    if (pending) router.replace(`/race/claim?t=${encodeURIComponent(pending)}`);
    else startTransition(() => setNoToken(true));
  }, [token, summary, router]);

  if (!token && !noToken) {
    return (
      <main className={shell}>
        <Skeleton className="h-48 w-full max-w-md rounded-2xl mx-6" />
      </main>
    );
  }

  if (!token || !summary) {
    return (
      <main className={shell}>
        <div className="text-center max-w-md px-6">
          <TriangleAlert className="w-12 h-12 text-light mx-auto mb-4" />
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-2">
            This link isn&apos;t valid
          </h1>
          <p className="text-light text-sm mb-8">
            The entry may have been withdrawn, or its details changed after this email was sent. Entries
            made under your sign-in email are in Activity, where you can add them to your profile.
          </p>
          <Link href="/activity" className="inline-flex items-center gap-2 text-primary font-headline text-sm font-bold uppercase tracking-widest">
            Go to Activity <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/user/registrations/${summary.registrationId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Couldn't add this race. Try again.");
        return;
      }
      writePending(null);
      setDone(true);
    } catch {
      setError("Couldn't add this race. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={shell}>
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-6">
          <Medal className="w-12 h-12 text-light mx-auto mb-4" />
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light">
            {done ? "On your profile" : "Add this race to your profile"}
          </h1>
        </div>

        <div className="rounded-2xl border border-dark-lighter bg-dark px-5 py-4 mb-6" data-testid="claim-summary">
          <p className="font-headline text-xl font-black tracking-tighter text-light leading-tight">{summary.eventTitle}</p>
          <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted mt-1.5">
            {formatShortDate(summary.eventDate)}{summary.place ? ` · ${summary.place}` : ""}
          </p>
          <p className="text-[13px] text-muted mt-3">Entry for {summary.athleteName}</p>
        </div>

        {done ? (
          <div className="text-center">
            <p className="text-light text-sm mb-6 inline-flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" /> This race and its results now show on your profile.
            </p>
            <div>
              <Link href="/profile" className={cta}>
                View my profile <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : status === "loading" ? (
          <Skeleton className="h-14 w-full rounded-md" />
        ) : status === "unauthenticated" ? (
          <div className="text-center">
            <p className="text-light text-sm mb-6">
              Sign in with the Startline account you want this race on. It doesn&apos;t have to use the email
              this link was sent to.
            </p>
            <Link href={`/race/claim?t=${encodeURIComponent(token)}&signin=true`} onClick={() => writePending(token)} className={cta}>
              Sign in or create account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <button type="button" onClick={add} disabled={busy} className={cta}>
              <Medal className="w-4 h-4" /> {busy ? "Adding" : "Add to my profile"}
            </button>
            {error && <p className="text-[13px] text-red-400 mt-4" role="alert">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
