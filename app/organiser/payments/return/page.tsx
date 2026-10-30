"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, AlertCircle, Clock, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

interface StripeStatus {
  connected:       boolean;
  chargesEnabled:  boolean;
  payoutsEnabled:  boolean;
  actionRequired?: boolean;
  error?:          string;
}

const eyebrowCls = "font-headline text-[11px] font-bold uppercase tracking-[0.25em] mb-3";
const titleCls   = "font-headline text-3xl font-black italic tracking-tighter text-light mb-3";
const bodyCls    = "text-muted text-[14px] mb-6";
const ctaCls =
  "inline-flex items-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest bg-machined text-dark px-6 py-3 rounded-xl shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform";

/**
 * Where Stripe's hosted onboarding sends the organiser back to. It says which
 * of three places they are in: finished, submitted and waiting on Stripe's
 * checks, or with something still to fill in.
 */
export default function PaymentsReturnPage() {
  const router = useRouter();
  const [status,  setStatus]  = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organiser/stripe/status")
      .then((r) => r.json())
      .then((data: StripeStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, chargesEnabled: false, payoutsEnabled: false }))
      .finally(() => setLoading(false));
  }, []);

  const verified  = !!(status?.chargesEnabled && status?.payoutsEnabled);
  // Only a reply that says so counts as "nothing left to do".
  const reviewing = !verified && status?.connected === true && status.actionRequired === false;

  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => router.push("/organiser/payments"), 3000);
    return () => clearTimeout(t);
  }, [verified, router]);

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6 pt-14">
      <div className="w-full max-w-[440px] text-center page-in">

        {loading && (
          <>
            <div className="flex justify-center mb-6" role="status" aria-label="Loading">
              <Skeleton className="h-16 w-16 rounded-full" />
            </div>
            <h1 className={titleCls}>Checking your account…</h1>
            <p className={bodyCls}>
              We&apos;re confirming your setup with Stripe. This only takes a moment.
            </p>
          </>
        )}

        {!loading && verified && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <div className={`${eyebrowCls} text-primary`}>All done</div>
            <h1 className={titleCls}>Stripe account connected.</h1>
            <p className={bodyCls}>
              Your account is verified and ready to receive payouts. Taking you back to payments…
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="font-headline text-[11px] uppercase tracking-widest text-muted">Redirecting…</span>
            </div>
          </>
        )}

        {!loading && reviewing && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <div className={`${eyebrowCls} text-primary`}>Details submitted</div>
            <h1 className={titleCls}>Stripe is reviewing.</h1>
            <p className={bodyCls}>
              You&apos;ve sent Stripe everything it asked for. It&apos;s verifying your identity now, which usually takes a few minutes and can take up to two business days. Payments switch on as soon as it finishes.
            </p>
            <Link href="/organiser/payments" className={ctaCls}>
              Back to payments <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}

        {!loading && !verified && !reviewing && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-amber-300" />
            </div>
            <div className={`${eyebrowCls} text-amber-300`}>Setup incomplete</div>
            <h1 className={titleCls}>Not quite finished.</h1>
            <p className={bodyCls}>
              Stripe still needs a few details before you can take payments. Head back to payments to continue where you left off.
            </p>
            <Link href="/organiser/payments" className={ctaCls}>
              Back to payments <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}

      </div>
    </main>
  );
}
