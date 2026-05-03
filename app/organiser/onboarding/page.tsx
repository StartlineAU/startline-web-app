"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, ArrowLeft, CheckCircle, Search, ExternalLink, Check } from "lucide-react";
import dynamic from "next/dynamic";

const Aurora = dynamic(() => import("@/components/ui/Aurora"), { ssr: false });

type AbnStatus = "idle" | "loading" | "found" | "not_found" | "unavailable";

const inputCls  = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";
const areaCls   = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none resize-none transition-colors";

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-light">
          {label}{required && <span className="text-primary ml-0.5">*</span>}
        </label>
        {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-muted-dark">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const STEPS = [
  { n: "01", label: "Organisation", sub: "Your details & bio"        },
  { n: "02", label: "Verification",  sub: "Insurance & past events"  },
  { n: "03", label: "Submit",        sub: "Review & send"            },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step,      setStep]      = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [abnStatus, setAbnStatus] = useState<AbnStatus>("idle");
  const [abnEntity, setAbnEntity] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    orgName: "", contactName: "", phone: "", abn: "", bio: "",
    insuranceUrl: "", pastEventsUrl: "", certifications: "",
    emailOnApprove: true, emailOnReject: true,
  });

  const u = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // ── Animated step transition ─────────────────────────────────────────────
  const goTo = (next: number) => {
    if (animating) return;
    setDirection(next > step ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setError("");
      setAnimating(false);
    }, 260);
  };

  // ── ABN lookup ──────────────────────────────────────────────────────────
  const lookupAbn = async () => {
    if (!form.abn) return;
    setAbnStatus("loading");
    try {
      const res = await fetch(`/api/abn?abn=${form.abn.replace(/\s/g, "")}`);
      if (res.status === 503) { setAbnStatus("unavailable"); return; }
      if (!res.ok)            { setAbnStatus("not_found"); return; }
      const data = await res.json();
      setAbnEntity(data.entityName);
      setAbnStatus("found");
    } catch {
      setAbnStatus("unavailable");
    }
  };

  // ── Validation ──────────────────────────────────────────────────────────
  const validateStep = (s: number) => {
    if (s === 0) {
      if (!form.orgName.trim())     { setError("Organisation name is required."); return false; }
      if (!form.contactName.trim()) { setError("Contact name is required."); return false; }
      if (!form.phone.trim())       { setError("Phone number is required."); return false; }
    }
    if (s === 1) {
      if (!form.insuranceUrl.trim()) { setError("Insurance document link is required."); return false; }
      if (!form.pastEventsUrl.trim()) { setError("Past events evidence link is required."); return false; }
    }
    return true;
  };

  // ── Save / submit ────────────────────────────────────────────────────────
  const save = async (submit = false) => {
    setError("");
    setSaving(true);
    try {
      const res  = await fetch("/api/organiser/profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, submit }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      if (submit) router.push("/organiser/pending");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    if (step < STEPS.length - 1) {
      save(false); // save progress silently
      goTo(step + 1);
    }
  };

  // ── Slide animation classes ──────────────────────────────────────────────
  const slideClass = animating
    ? direction === "forward"
      ? "opacity-0 translate-x-8"
      : "opacity-0 -translate-x-8"
    : "opacity-100 translate-x-0";

  return (
    <main className="min-h-screen bg-dark-darker relative">

      {/* ── Aurora — centred in viewport ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Aurora fills the full fixed layer so the shader sees correct dimensions */}
        <div className="absolute inset-0 opacity-70">
          <Aurora
            colorStops={["#0a1a05", "#1a3d08", "#b3e153"]}
            amplitude={1.2}
            blend={0.65}
            speed={0.6}
          />
        </div>
        {/* Vignette — fade all four edges into the background colour */}
        <div className="absolute inset-x-0 top-0    h-[30%] bg-gradient-to-b  from-dark-darker to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t  from-dark-darker to-transparent" />
        <div className="absolute inset-y-0 left-0   w-[20%] bg-gradient-to-r  from-dark-darker to-transparent" />
        <div className="absolute inset-y-0 right-0  w-[20%] bg-gradient-to-l  from-dark-darker to-transparent" />
        {/* Scan-grid overlay */}
        <div className="absolute inset-0 scan-grid opacity-50" />
      </div>

      {/* ── Minimal top bar — logo centred ── */}
      <div className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-center">
        <Image src="/images/logo-title.svg" alt="Startline" width={140} height={36} className="h-8 w-auto" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 pt-16 min-h-screen flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-[600px]">

          {/* ── Step indicators — same style as event listing ── */}
          <div className="flex items-center mb-10">
            {STEPS.map((s, i) => {
              const done = i < step;
              const cur  = i === step;
              return (
                <div key={s.n} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex items-center gap-2.5 transition-opacity ${cur ? "opacity-100" : "opacity-70"}`}>
                    <div className={`w-8 h-8 rounded-md border flex items-center justify-center font-headline font-black italic text-[13px] flex-shrink-0 transition-colors duration-300
                      ${cur  ? "bg-primary text-dark border-primary"
                      : done ? "bg-dark-lighter text-primary border-primary/40"
                      :        "bg-dark border-dark-lighter text-muted-dark"}`}>
                      {done ? <Check className="w-4 h-4" /> : s.n}
                    </div>
                    <div className="hidden sm:block">
                      <div className={`font-headline text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-300 ${cur ? "text-light" : "text-muted"}`}>
                        {s.label}
                      </div>
                      <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark whitespace-nowrap">
                        {s.sub}
                      </div>
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-3 step-line" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step label */}
          <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-primary" /> Step {step + 1} of {STEPS.length}
          </div>

          {/* Animated step content */}
          <div
            ref={containerRef}
            className={`transition-all duration-[260ms] ease-in-out ${slideClass}`}
          >

            {/* ── Step 1: Organisation ── */}
            {step === 0 && (
              <>
                <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                  Tell us about your<br /><span className="text-primary">organisation.</span>
                </h1>
                <p className="text-muted text-[14px] mb-8">
                  This information is reviewed by our team. You can add social links and a logo in your profile settings once approved.
                </p>

                {error && <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>}

                <Field label="Organisation / company name" required>
                  <input value={form.orgName} onChange={(e) => u({ orgName: e.target.value })}
                    placeholder="Endurance Events Australia" className={inputCls} />
                </Field>

                <div className="grid grid-cols-2 gap-5">
                  <Field label="Contact person" required>
                    <input value={form.contactName} onChange={(e) => u({ contactName: e.target.value })}
                      placeholder="Jane Smith" className={inputCls} />
                  </Field>
                  <Field label="Phone" required>
                    <input type="tel" value={form.phone} onChange={(e) => u({ phone: e.target.value })}
                      placeholder="+61 4XX XXX XXX" className={inputCls} />
                  </Field>
                </div>

                <Field label="ABN" hint="Optional — live lookup available">
                  <div className="flex gap-2">
                    <input value={form.abn} onChange={(e) => { u({ abn: e.target.value }); setAbnStatus("idle"); }}
                      placeholder="XX XXX XXX XXX" className={`${inputCls} flex-1`} />
                    <button type="button" onClick={lookupAbn} disabled={!form.abn || abnStatus === "loading"}
                      className="px-4 py-3 bg-dark border border-dark-lighter rounded-md text-muted hover:text-primary hover:border-primary/60 transition-colors disabled:opacity-40 flex items-center gap-2 font-headline text-[12px] uppercase tracking-widest">
                      <Search className="w-4 h-4" /> {abnStatus === "loading" ? "…" : "Verify"}
                    </button>
                  </div>
                  {abnStatus === "found"       && <p className="mt-1.5 font-headline text-[11px] uppercase tracking-widest text-primary flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {abnEntity}</p>}
                  {abnStatus === "not_found"   && <p className="mt-1.5 font-headline text-[11px] uppercase tracking-widest text-red-400">ABN not found in the register.</p>}
                  {abnStatus === "unavailable" && <p className="mt-1.5 font-headline text-[11px] uppercase tracking-widest text-muted">Lookup unavailable — enter ABN manually.</p>}
                </Field>

                <Field label="About your organisation" hint={`${form.bio.length}/500`}>
                  <textarea rows={4} maxLength={500} value={form.bio} onChange={(e) => u({ bio: e.target.value })}
                    placeholder="Briefly describe the types of events you run and your experience as an event organiser."
                    className={areaCls} />
                </Field>
              </>
            )}

            {/* ── Step 2: Verification ── */}
            {step === 1 && (
              <>
                <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                  Verify your<br /><span className="text-primary">credentials.</span>
                </h1>
                <p className="text-muted text-[14px] mb-4">
                  Upload your documents to Google Drive, Dropbox or similar and paste the shareable link below.
                </p>
                <div className="bg-primary/5 border border-primary/20 rounded-md p-4 mb-6 flex gap-3">
                  <ExternalLink className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="font-headline text-[11px] uppercase tracking-widest text-muted-light leading-relaxed">
                    Make sure links are accessible to anyone. In Google Drive: Share → Anyone with the link → Viewer.
                  </p>
                </div>

                {error && <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>}

                <Field label="Public liability insurance" required hint="PDF or image link">
                  <input type="url" value={form.insuranceUrl} onChange={(e) => u({ insuranceUrl: e.target.value })}
                    placeholder="https://drive.google.com/…" className={inputCls} />
                  <p className="mt-1.5 font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                    Current certificate of currency covering event activities in Australia.
                  </p>
                </Field>

                <Field label="Evidence of past events" required hint="Link to portfolio or examples">
                  <input type="url" value={form.pastEventsUrl} onChange={(e) => u({ pastEventsUrl: e.target.value })}
                    placeholder="https://drive.google.com/… or https://yourorg.com/events" className={inputCls} />
                  <p className="mt-1.5 font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                    Event website, results page, photos or a document listing events you&apos;ve run.
                  </p>
                </Field>

                <Field label="Certifications" hint="Optional">
                  <textarea rows={3} value={form.certifications} onChange={(e) => u({ certifications: e.target.value })}
                    placeholder="e.g. Athletics Australia affiliate, CrossFit HQ licensed affiliate, accredited race director course."
                    className={areaCls} />
                </Field>
              </>
            )}

            {/* ── Step 3: Submit ── */}
            {step === 2 && (
              <>
                <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                  Ready to<br /><span className="text-primary">submit.</span>
                </h1>
                <p className="text-muted text-[14px] mb-8">
                  Review your notification preferences, then submit your application. Our team typically responds within 1–2 business days.
                </p>

                {error && <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>}

                <div className="space-y-3 mb-8">
                  {[
                    { key: "emailOnApprove" as const, title: "Application approved", desc: "Email when your account or an event is approved." },
                    { key: "emailOnReject"  as const, title: "Application update",   desc: "Email when your account or an event requires attention." },
                  ].map(({ key, title, desc }) => (
                    <label key={key} className="flex items-start gap-4 p-4 bg-dark border border-dark-lighter rounded-lg cursor-pointer hover:border-primary/40 transition-colors">
                      <input type="checkbox" checked={form[key]} onChange={(e) => u({ [key]: e.target.checked })}
                        className="accent-primary w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-headline text-[13px] font-bold uppercase tracking-tight text-light">{title}</div>
                        <div className="font-headline text-[11px] uppercase tracking-widest text-muted mt-0.5">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Summary checklist */}
                <div className="bg-dark border border-dark-lighter rounded-lg p-5 mb-2">
                  <div className="font-headline text-[10px] uppercase tracking-widest text-primary mb-3">Before you submit</div>
                  <ul className="space-y-2">
                    {[
                      "Organisation details are complete",
                      "Insurance document link is active and accessible",
                      "Past events evidence is accessible",
                    ].map((s, i) => (
                      <li key={i} className="flex items-center gap-2 font-headline text-[12px] uppercase tracking-widest text-muted-light">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

          </div>

          {/* ── Navigation buttons ── */}
          <div className="flex items-center justify-between pt-6 border-t border-dark-lighter mt-8">
            <button
              onClick={() => step > 0 ? goTo(step - 1) : router.push("/organiser")}
              className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Back to sign in" : "Back"}
            </button>

            <div className="flex items-center gap-3">
              <button onClick={() => save(false)} disabled={saving}
                className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light px-5 py-3 transition-colors disabled:opacity-40">
                Save draft
              </button>

              {step < STEPS.length - 1 ? (
                <button onClick={handleNext} disabled={animating}
                  className="bg-machined shadow-machined text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={() => save(true)} disabled={saving}
                  className="bg-machined shadow-machined text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? "Submitting…" : <>Submit application <ArrowRight className="w-4 h-4" /></>}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
