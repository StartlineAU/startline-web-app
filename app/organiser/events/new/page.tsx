"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import {
  ArrowLeft, Save, RefreshCw, AlertCircle, CheckCircle,
  ChevronDown,
} from "lucide-react";
import {
  EventType, AustralianState, CompetitionFormat, ExperienceLevel,
  EVENT_TYPE_OPTIONS, STATE_OPTIONS,
} from "@/types";

interface FormData {
  title: string;
  description: string;
  type: EventType | "";
  level: ExperienceLevel | "";
  format: CompetitionFormat | "";
  distance: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  city: string;
  state: AustralianState | "";
  registrationUrl: string;
  image: string;
}

const EMPTY: FormData = {
  title: "", description: "", type: "", level: "", format: "",
  distance: "", date: "", time: "", endTime: "",
  location: "", city: "", state: "", registrationUrl: "", image: "",
};

export default function NewEventPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function field<K extends keyof FormData>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/organiser/events/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submission failed.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/organiser/dashboard"), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
        <RefreshCw className="w-6 h-6 text-muted animate-spin" />
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-primary/10 border border-primary/40 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-2">
            Event Submitted!
          </h1>
          <p className="text-muted text-sm mb-6">
            Your event is pending admin review. You&apos;ll be able to see its status on your dashboard.
          </p>
          <Link
            href="/organiser/dashboard"
            className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
          >
            Go to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const inputCls = "w-full bg-transparent text-light font-headline text-sm border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 placeholder:text-muted/30 transition-colors";
  const selectCls = "w-full appearance-none bg-transparent text-light font-headline text-sm border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 cursor-pointer transition-colors";
  const labelCls = "block font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-1.5";

  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="bg-dark border-b border-dark-lighter">
        <div className="max-w-3xl mx-auto px-6 pt-48 pb-12">
          <Link
            href="/organiser/dashboard"
            className="inline-flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Dashboard
          </Link>
          <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light leading-none">
            Submit an <span className="text-primary">Event</span>
          </h1>
          <p className="text-muted text-sm mt-3">
            Fill in the details below. Your event will be reviewed by an admin before going live.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-12">
        <form onSubmit={handleSubmit} className="bg-dark rounded-xl p-8 space-y-8">
          {/* Title */}
          <div>
            <label className={labelCls}>Event Title *</label>
            <input type="text" required value={form.title} onChange={field("title")} placeholder="e.g. HYROX Sydney" className={inputCls} />
          </div>

          {/* Type / Level / Format */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Type *</label>
              <div className="relative">
                <select required value={form.type} onChange={field("type")} className={selectCls}>
                  <option value="" disabled className="bg-dark text-muted">Select</option>
                  {EVENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-dark text-light">{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 bottom-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Level *</label>
              <div className="relative">
                <select required value={form.level} onChange={field("level")} className={selectCls}>
                  <option value="" disabled className="bg-dark text-muted">Select</option>
                  <option value="open" className="bg-dark text-light">Open</option>
                  <option value="beginner" className="bg-dark text-light">Beginner</option>
                  <option value="elite" className="bg-dark text-light">Elite</option>
                </select>
                <ChevronDown className="absolute right-0 bottom-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Format *</label>
              <div className="relative">
                <select required value={form.format} onChange={field("format")} className={selectCls}>
                  <option value="" disabled className="bg-dark text-muted">Select</option>
                  <option value="individual" className="bg-dark text-light">Individual</option>
                  <option value="team" className="bg-dark text-light">Team / Pairs</option>
                  <option value="both" className="bg-dark text-light">Both</option>
                </select>
                <ChevronDown className="absolute right-0 bottom-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description *</label>
            <textarea required rows={4} value={form.description} onChange={field("description")} placeholder="Describe the event..." className={`${inputCls} resize-y border border-dark-lighter p-3`} />
          </div>

          {/* Date / Time */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" required value={form.date} onChange={field("date")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start Time *</label>
              <input type="time" required value={form.time} onChange={field("time")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End Time</label>
              <input type="time" value={form.endTime} onChange={field("endTime")} className={inputCls} />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Venue *</label>
              <input type="text" required value={form.location} onChange={field("location")} placeholder="e.g. Sydney Olympic Park" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City *</label>
              <input type="text" required value={form.city} onChange={field("city")} placeholder="e.g. Sydney" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State *</label>
              <div className="relative">
                <select required value={form.state} onChange={field("state")} className={selectCls}>
                  <option value="" disabled className="bg-dark text-muted">Select</option>
                  {STATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-dark text-light">{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 bottom-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Registration URL + Distance */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Registration URL *</label>
              <input type="url" required value={form.registrationUrl} onChange={field("registrationUrl")} placeholder="https://..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Distance</label>
              <input type="text" value={form.distance} onChange={field("distance")} placeholder="e.g. 42.2km" className={inputCls} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 font-headline text-xs font-medium uppercase tracking-widest">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-8 py-4 rounded-xl machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Submitting..." : "Submit Event"}
          </button>
        </form>
      </section>
    </main>
  );
}
