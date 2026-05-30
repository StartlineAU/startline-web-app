"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OrganiserTopBar from "@/components/organiser/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertCircle, CreditCard, ArrowRight, ExternalLink, ShieldCheck, RefreshCw, UserCog } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full bg-white border border-gray-200 rounded-md px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none transition-colors";

interface Profile {
  orgName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  legalName: string | null;
  abn: string | null;
  insuranceDeclared: boolean;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
}

function maskAccountId(id: string) {
  if (id.length <= 8) return id;
  return id.slice(0, 8) + "•".repeat(id.length - 8);
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const refreshed    = searchParams.get("refresh") === "1";

  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error,     setError]     = useState("");

  const [legalName,         setLegalName]         = useState("");
  const [abn,               setAbn]               = useState("");
  const [insuranceDeclared, setInsuranceDeclared] = useState(false);

  useEffect(() => {
    fetch("/api/organiser/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data: Profile | null) => {
        if (!data) return;
        setProfile(data);
        setLegalName(data.legalName ?? "");
        setAbn(data.abn ?? "");
        setInsuranceDeclared(data.insuranceDeclared ?? false);
      })
      .finally(() => setLoading(false));
  }, []);

  const profileIncomplete =
    !profile?.orgName || !profile?.contactName || !profile?.contactEmail || !profile?.phone;

  const saveAndConnect = async () => {
    setError("");

    if (profileIncomplete) {
      setError("Please complete your organiser profile before connecting Stripe.");
      return;
    }
    if (!legalName.trim()) {
      setError("Legal name is required before connecting your Stripe account.");
      return;
    }
    if (!abn.trim()) {
      setError("ABN or ACN is required before connecting your Stripe account (required for ATO reporting under ToS §3.2).");
      return;
    }
    if (!insuranceDeclared) {
      setError("You must declare that you hold current public liability insurance ($10M minimum) before connecting.");
      return;
    }

    setSaving(true);
    try {
      // Merge new compliance fields into existing profile data for the PUT
      const res = await fetch("/api/organiser/profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orgName:      profile?.orgName      ?? "",
          contactName:  profile?.contactName  ?? "",
          contactEmail: profile?.contactEmail ?? "",
          phone:        profile?.phone        ?? "",
          legalName,
          abn,
          insuranceDeclared,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Failed to save profile.");
        return;
      }
    } finally {
      setSaving(false);
    }

    setConnecting(true);
    try {
      const res  = await fetch("/api/organiser/stripe/connect", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to generate Stripe onboarding link. Please try again.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setConnecting(false);
    }
  };

  const continueSetup = async () => {
    setConnecting(true);
    try {
      const res  = await fetch("/api/organiser/stripe/connect", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to generate Stripe link.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OrganiserTopBar />
        <main className="pt-16">
          <div className="max-w-[760px] mx-auto px-6 py-16 text-center">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
          </div>
        </main>
      </div>
    );
  }

  const isConnected   = profile?.stripeOnboardingComplete === true;
  const inProgress    = !!profile?.stripeAccountId && !isConnected;

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganiserTopBar />

      <main className="pt-16">
        <div className="max-w-[760px] mx-auto px-6 py-10 pb-24 lg:pb-12 page-in">

          {/* Header */}
          <div className="mb-8">
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-3">
              Payments
            </div>
            <h1 className="font-headline text-[44px] font-black italic tracking-tighter leading-none text-gray-900 mb-3">
              Get paid for<br /><span className="text-lime-500">your events.</span>
            </h1>
            <p className="text-gray-500 text-[15px] max-w-lg">
              To accept registrations and receive payouts through Startline, you need to connect a Stripe Express account. This is only required for marketplace listings — directory listings linking to an external platform don't need this.
            </p>
          </div>

          {/* Refresh banner (returned from Stripe before completing) */}
          {refreshed && !isConnected && (
            <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <RefreshCw className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-headline text-[13px] font-bold text-amber-800 uppercase tracking-widest mb-0.5">Setup not complete</div>
                <div className="text-[13px] text-amber-700">It looks like you left Stripe before finishing. Click continue below to pick up where you left off.</div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-[13px] text-red-700">{error}</div>
            </div>
          )}

          {/* ── State 1: Connected ── */}
          {isConnected && (
            <Card className="mb-6 border-lime-200 bg-lime-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-lime-500 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-lime-800 mb-1">
                      Stripe account connected
                    </div>
                    <div className="text-[13px] text-lime-700 mb-3">
                      Your Stripe Express account is verified and ready to receive payouts.
                      Account: <span className="font-mono">{maskAccountId(profile?.stripeAccountId ?? "")}</span>
                    </div>
                    <a
                      href="https://connect.stripe.com/express_login"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest text-lime-800 hover:text-lime-900 transition-colors"
                    >
                      Manage payouts in Stripe <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── State 2: In progress ── */}
          {inProgress && (
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-blue-800 mb-1">
                      Stripe setup in progress
                    </div>
                    <div className="text-[13px] text-blue-700 mb-4">
                      Your Stripe account has been created but identity verification is not yet complete. Continue where you left off to start accepting payments.
                    </div>
                    <button
                      onClick={continueSetup}
                      disabled={connecting}
                      className="inline-flex items-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest bg-blue-600 text-white px-5 py-3 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connecting
                        ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Opening Stripe…</>
                        : <>Continue Stripe setup <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile-incomplete warning */}
          {profileIncomplete && (
            <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <UserCog className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-headline text-[13px] font-bold text-amber-800 uppercase tracking-widest mb-0.5">
                  Complete your profile first
                </div>
                <div className="text-[13px] text-amber-700 mb-2">
                  Your organiser profile is missing required fields (organisation name, contact name, phone, and contact email).
                  These are needed before you can connect Stripe.
                </div>
                <Link
                  href="/organiser/profile"
                  className="inline-flex items-center gap-1.5 font-headline text-[12px] font-bold uppercase tracking-widest text-amber-800 underline hover:text-amber-900 transition-colors"
                >
                  Go to profile <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* ── Form: Legal name, ABN, Insurance + Connect button ── */}
          {/* Always shown so organiser can update details even if connected */}
          <Card>
            <CardContent className="p-6 lg:p-8">
              <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900 mb-1">
                {isConnected ? "Your details" : "Step 1 — Your details"}
              </h2>
              <p className="text-[13px] text-gray-500 mb-6">
                Required for ATO tax reporting under the Sharing Economy Reporting Regime (SERR). Stripe holds your bank account and identity details — Startline only stores your legal name, ABN, and a Stripe account reference.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-700 block mb-2">
                    Legal name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Jane Smith"
                    className={inputCls}
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5">Your legal first and last name as it appears on your ID. Required for ATO SERR reporting.</p>
                </div>

                <div>
                  <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-700 block mb-2">
                    ABN or ACN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={abn}
                    onChange={(e) => setAbn(e.target.value)}
                    placeholder="12 345 678 901"
                    className={inputCls}
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Required under ATO PAYG withholding rules. Without a valid ABN, Startline is legally required to withhold 47% of payouts (ToS §3.2).
                  </p>
                </div>
              </div>

              {/* Insurance declaration */}
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <ShieldCheck className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-gray-700 mb-2">
                      Public liability insurance declaration
                    </div>
                    <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                      Before listing events on Startline, you must hold and maintain current public liability insurance with a minimum coverage of <strong>$10 million per occurrence</strong>, underwritten by an APRA-registered insurer, covering the full duration of each event. Startline does not collect or verify insurance certificates — this is a self-declaration on your honour (ToS §5.3).
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={insuranceDeclared}
                          onChange={(e) => setInsuranceDeclared(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${insuranceDeclared ? "bg-lime-500 border-lime-500" : "bg-white border-gray-300 group-hover:border-gray-500"}`}>
                          {insuranceDeclared && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-[13px] text-gray-700 leading-relaxed">
                        I declare that I currently hold public liability insurance meeting Startline's minimum requirements, and I will maintain this coverage for the full duration of every event I list.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Connect / update button */}
              {!isConnected && (
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900 mb-1">
                    Step 2 — Connect Stripe
                  </h2>
                  <p className="text-[13px] text-gray-500 mb-5">
                    You'll be taken to Stripe's secure, hosted onboarding. Stripe will collect your date of birth (for identity verification) and bank account details for payouts. Startline never sees or stores this information.
                  </p>
                  <button
                    onClick={saveAndConnect}
                    disabled={saving || connecting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-headline text-[13px] font-bold uppercase tracking-widest bg-gray-900 text-white px-8 py-4 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving || connecting
                      ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {saving ? "Saving…" : "Opening Stripe…"}</>
                      : <>{inProgress ? "Continue Stripe setup" : "Connect with Stripe"} <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* What Stripe holds — transparency note */}
          <div className="mt-6 px-5 py-4 bg-white border border-gray-200 rounded-xl">
            <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">
              What Startline stores vs. what Stripe holds
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="font-headline text-[11px] uppercase tracking-widest text-gray-700 font-bold mb-2">Startline stores</div>
                <ul className="text-[12px] text-gray-600 space-y-1">
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-lime-500 shrink-0" /> Legal name</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-lime-500 shrink-0" /> Email address</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-lime-500 shrink-0" /> ABN or ACN</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-lime-500 shrink-0" /> Stripe account reference ID</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-lime-500 shrink-0" /> Insurance self-declaration (boolean)</li>
                </ul>
              </div>
              <div>
                <div className="font-headline text-[11px] uppercase tracking-widest text-gray-700 font-bold mb-2">Stripe holds (not Startline)</div>
                <ul className="text-[12px] text-gray-600 space-y-1">
                  <li className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" /> Date of birth (KYC)</li>
                  <li className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" /> Bank account BSB + account number</li>
                  <li className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" /> Identity verification documents</li>
                  <li className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" /> Full card payment credentials</li>
                </ul>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              See{" "}
              <a href="https://stripe.com/au/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">stripe.com/au/privacy</a>
              {" "}and{" "}
              <a href="https://stripe.com/au/legal/connect-account" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Stripe Connected Account Agreement</a>
              {" "}for full details on how Stripe handles your information.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsContent />
    </Suspense>
  );
}
