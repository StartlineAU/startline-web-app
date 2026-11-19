"use client";

import { useState, type FormEvent } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: turnstileToken ?? undefined }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="waitlist-success">
        <div className="waitlist-success-title">You&apos;re in.</div>
        <div className="waitlist-success-sub">
          We&apos;ll email you the second the gates open.
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="waitlist-form">
        <div className="flex-1">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status !== "idle") setStatus("idle");
            }}
            placeholder="you@email.com"
            required
            disabled={status === "loading"}
            className="waitlist-input"
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="waitlist-btn"
        >
          {status === "loading" ? "Joining…" : "Notify Me"}
        </button>
      </form>

      <p className="waitlist-hint">Be first in line. Unsubscribe anytime.</p>
      {/* Invisible widget: renders nothing without a site key (dev, E2E). */}
      <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setTurnstileToken} />

      {status === "error" && (
        <p className="mt-3 text-[13.5px] text-center text-red-400">
          {message}
        </p>
      )}
    </>
  );
}
