"use client";

import { useState } from "react";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Shield, Lock } from "lucide-react";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
  if (!stripePromise && stripePublishableKey) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
}

export default function StripePaymentSection({
  clientSecret,
  eventId,
  totalPrice,
  onError,
}: {
  clientSecret: string;
  eventId: string;
  totalPrice: number;
  onError: (msg: string) => void;
}) {
  const p = getStripe();

  if (!p || !clientSecret) {
    return (
      <div className="bg-dark rounded-xl p-6 text-center">
        <p className="text-[13px] text-muted">Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable payments.</p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#B3E153",
        colorBackground: "#1a1a2e",
        colorText: "#e0e0e0",
        colorDanger: "#ef4444",
        fontFamily: "system-ui, sans-serif",
        borderRadius: "8px",
      },
    },
  };

  return (
    <Elements stripe={p} options={options}>
      <CheckoutForm
        clientSecret={clientSecret}
        eventId={eventId}
        totalPrice={totalPrice}
        onError={onError}
      />
    </Elements>
  );
}

function CheckoutForm({
  clientSecret,
  eventId,
  totalPrice,
  onError,
}: {
  clientSecret: string;
  eventId: string;
  totalPrice: number;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    setSubmitting(true);
    onError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/events/${eventId}/register/confirmation`,
      },
    });

    if (error) {
      onError(error.message ?? "Payment failed.");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-dark rounded-xl p-5">
        <h2 className="font-headline text-xs font-medium uppercase tracking-widest text-primary mb-4">Payment details</h2>
        <PaymentElement />
      </div>

      <div className="flex items-start gap-3 px-1">
        <Shield className="w-4 h-4 text-muted mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted leading-relaxed">
          Your payment is processed securely via Stripe. Your card details are never stored on our servers.
        </p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!stripe || submitting}
        className="w-full py-4 rounded-md font-headline text-[13px] font-bold uppercase tracking-widest bg-primary text-dark hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
      >
        {submitting
          ? <><span className="w-4 h-4 border-2 border-dark/40 border-t-dark rounded-full animate-spin" /> Processing…</>
          : <>Pay ${totalPrice.toFixed(2)} <Lock className="w-3 h-3" /></>}
      </button>
    </div>
  );
}
