"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

const StripePaymentSection = dynamic(() => import("./stripe-payment"), { ssr: false });

const inputCls =
  "w-full bg-dark-light border border-dark-border rounded-md px-4 py-3 text-[15px] text-light placeholder:text-muted focus:border-primary focus:outline-none transition-colors";

interface Wave {
  label: string;
  price: string;
  qty?: number;
  date?: string;
}

interface EventData {
  id: string;
  title: string;
  eventDate: string;
  venue: string;
  city: string;
  state: string;
  waves: Wave[];
  feeStructure: string;
  registrationType: string;
  coverImageUrl: string | null;
  organiser: {
    id: string;
    orgName: string | null;
    logoUrl: string | null;
  };
}

export default function RegisterPage() {
  return (
    <RegisterContent />
  );
}

function RegisterContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const preselectedWave = searchParams.get("wave") ?? "";

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [category, setCategory] = useState("");
  const [selectedWave, setSelectedWave] = useState(preselectedWave);
  const [clientSecret, setClientSecret] = useState("");
  const [processing, setProcessing] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"details" | "payment">("details");

  useEffect(() => {
    fetch(`/api/events`)
      .then((r) => r.json())
      .then((events: EventData[]) => {
        const found = events.find((e) => e.id === eventId);
        if (found) setEvent(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  const selectedWaveData = event?.waves?.find((w) => w.label === selectedWave);
  const ticketPrice = selectedWaveData ? parseFloat(selectedWaveData.price || "0") : 0;
  const platformFeePercent = 0.0395;
  const platformFeeFixed = 1.45;
  const platformFee = event?.feeStructure === "athlete"
    ? ticketPrice * platformFeePercent + platformFeeFixed
    : 0;
  const totalPrice = event?.feeStructure === "athlete"
    ? ticketPrice + platformFee
    : ticketPrice;

  const handleGoToPayment = useCallback(async () => {
    if (!customerName || !customerEmail || !selectedWave) {
      setError("Please fill in all required fields.");
      return;
    }

    setError("");
    setProcessing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          waveLabel: selectedWave,
          customerName,
          customerEmail,
          category,
        }),
      });
      const data = await res.json() as { clientSecret?: string; error?: string };
      if (!res.ok || !data.clientSecret) {
        setError(data.error ?? "Failed to create payment.");
        setProcessing(false);
        return;
      }
      setClientSecret(data.clientSecret);
      setCheckoutStep("payment");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setProcessing(false);
  }, [eventId, selectedWave, customerName, customerEmail, category]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-darker flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-dark-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-dark-darker flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-headline text-2xl font-black italic text-light mb-2">Event not found</h1>
          <Link href="/events" className="font-headline text-xs uppercase tracking-widest text-primary hover:text-primary/80">Back to events</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-darker">
      <div className="max-w-[600px] mx-auto px-4 py-8">
        <Link href={`/events/${eventId}`} className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6">
          <ArrowLeft className="w-3 h-3" /> Back to event
        </Link>

        <div className="mb-6">
          <h1 className="font-headline text-[28px] font-black italic tracking-tighter text-light leading-none mb-2">
            Register
          </h1>
          <p className="text-[13px] text-muted">{event.title}</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-[13px] text-red-300">
            {error}
          </div>
        )}

        {checkoutStep === "details" && (
          <div className="space-y-6">
            <div className="bg-dark rounded-xl p-5">
              <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">Ticket selection</h2>
              <div className="space-y-2">
                {event.waves?.map((wave) => (
                  <button
                    key={wave.label}
                    onClick={() => setSelectedWave(wave.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left ${selectedWave === wave.label ? "border-primary bg-primary/10" : "border-dark-border hover:border-dark-border/60"}`}
                  >
                    <div>
                      <p className="font-headline text-sm font-bold text-light">{wave.label}</p>
                      {wave.date && <p className="text-[11px] text-muted uppercase tracking-widest mt-0.5">Until {wave.date}</p>}
                    </div>
                    <span className="font-headline text-lg font-black italic text-primary">${parseFloat(wave.price || "0").toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-dark rounded-xl p-5 space-y-4">
              <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-1">Your details</h2>

              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1">Full name *</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Alex Rossi" className={inputCls} />
              </div>

              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1">Email *</label>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="alex@example.com" className={inputCls} />
              </div>

              <div>
                <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1">Category (optional)</label>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Individual RX" className={inputCls} />
              </div>
            </div>

            {selectedWave && (
              <div className="bg-dark rounded-xl p-5">
                <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-3">Order summary</h2>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between text-muted">
                    <span>Ticket ({selectedWave})</span>
                    <span>${ticketPrice.toFixed(2)}</span>
                  </div>
                  {event.feeStructure === "athlete" && (
                    <div className="flex justify-between text-muted">
                      <span>Service fee (3.95% + $1.45)</span>
                      <span>${platformFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-dark-border pt-2 flex justify-between text-light font-bold">
                    <span>Total</span>
                    <span className="font-headline text-lg font-black italic text-primary">${totalPrice.toFixed(2)}</span>
                  </div>
                  {event.feeStructure === "organiser" && (
                    <div className="text-[11px] text-muted mt-1">Service fee (3.95% + $1.45) is covered by the organiser.</div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleGoToPayment}
              disabled={processing || !selectedWave}
              className="w-full py-4 rounded-md font-headline text-[13px] font-bold uppercase tracking-widest bg-primary text-dark hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {processing ? (
                <><span className="w-4 h-4 border-2 border-dark/40 border-t-dark rounded-full animate-spin" /> Processing…</>
              ) : (
                <>Continue to payment <Lock className="w-3 h-3" /></>
              )}
            </button>
          </div>
        )}

        {checkoutStep === "payment" && clientSecret && (
          <StripePaymentSection
            clientSecret={clientSecret}
            eventId={eventId}
            totalPrice={totalPrice}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}
