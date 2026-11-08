"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const inputCls =
  "w-full bg-dark-light border border-dark-lighter rounded-[10px] px-[15px] py-3 text-[14.5px] text-light placeholder:text-placeholder outline-none focus:border-primary";
const labelCls = "font-headline font-bold text-[10.5px] uppercase tracking-[0.15em] text-light";

export default function SupportForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState<"refund" | "other">("refund");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [reason, setReason] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          requestType,
          eventName: eventName.trim() || undefined,
          eventDate: eventDate || undefined,
          reason: reason.trim(),
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send that. Please try again.");
        return;
      }
      setTicketId(data.id);
    } catch {
      setError("Could not send that. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (ticketId) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-6">
        <h2 className="font-headline text-[20px] font-black uppercase tracking-wide text-light">Ticket opened</h2>
        <p className="text-[14px] text-muted-light mt-2 leading-relaxed">
          Your reference is <span className="text-light">{ticketId.slice(0, 8)}</span>. Startline will reply to {email}.
          A refund is not issued from this form.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className={labelCls}>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>Email</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>What do you need?</span>
        <select value={requestType} onChange={(e) => setRequestType(e.target.value as "refund" | "other")} className={inputCls}>
          <option value="refund">Refund</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>Event</span>
        <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name" className={inputCls} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>Event date</span>
        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />
      </label>
      <label className="grid gap-1.5">
        <span className={labelCls}>Reason</span>
        <textarea required rows={5} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="What happened, and what you want us to do." />
      </label>
      {TURNSTILE_SITE_KEY && (
        <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setTurnstileToken} />
      )}
      {error && <p className="text-[13px] text-red-300">{error}</p>}
      <p className="text-[12px] text-muted-dark leading-relaxed">
        Refunds are not available within 24 hours of the event start. Australian Consumer Law rights still apply if the event is cancelled or significantly changed. Opening a ticket does not refund you.
      </p>
      <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-machined text-dark font-headline text-[13px] font-black uppercase tracking-[0.12em] shadow-machined disabled:opacity-50">
        <Send className="w-4 h-4" />
        {submitting ? "Sending…" : "Open a ticket"}
      </button>
    </form>
  );
}
