"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, ArrowLeft, CheckCircle, Search, ExternalLink } from "lucide-react";

type AbnStatus = "idle" | "loading" | "found" | "not_found" | "unavailable";

const inputCls = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors";
const textareaCls = "w-full bg-dark border border-dark-lighter rounded-md px-4 py-3 text-[14px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none resize-none transition-colors";

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

export default function OnboardingPage() {
  const router = useRouter();
  const [step,    setStep]    = useState(0);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [abnStatus, setAbnStatus] = useState<AbnStatus>("idle");
  const [abnEntity, setAbnEntity] = useState<string>("");

  const [form, setForm] = useState({
    orgName: "", contactName: "", phone: "", abn: "",
    website: "", instagram: "", facebook: "", bio: "", logoUrl: "",
    insuranceUrl: "", pastEventsUrl: "", certifications: "",
    emailOnApprove: true, emailOnReject: true,
  });

  const u = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const lookupAbn = async () => {
    if (!form.abn) return;
    setAbnStatus("loading");
    try {
      const res  = await fetch(`/api/abn?abn=${form.abn.replace(/\s/g, "")}`);
      if (res.status === 503) { setAbnStatus("unavailable"); return; }
      if (!res.ok)            { setAbnStatus("not_found"); return; }
      const data = await res.json();
      setAbnEntity(data.entityName);
      setAbnStatus("found");
    } catch {
      setAbnStatus("unavailable");
    }
  };

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

  const steps = ["Organisation", "Verification", "Preferences"];

  return (
    <main className="min-h-screen bg-dark-darker">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-16 bg-dark border-b border-dark-lighter flex items-center px-6">
        <Image src="/images/logo-title.svg" alt="Startline" width={140} height={36} className="h-8 w-auto" />
        <div className="ml-auto flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-headline font-black italic text-[11px]
                ${i < step ? "bg-primary text-dark border-primary" : i === step ? "border-primary text-primary" : "border-dark-lighter text-muted-dark"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`font-headline text-[11px] uppercase tracking-widest hidden md:inline ${i === step ? "text-light" : "text-muted-dark"}`}>{s}</span>
              {i < steps.length - 1 && <span className="w-8 h-px bg-dark-lighter mx-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="pt-16 min-h-screen flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-[640px]">
          <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-primary" /> Step {step + 1} of {steps.length}
          </div>

          {step === 0 && (
            <>
              <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                Tell us about your<br /><span className="text-primary">organisation.</span>
              </h1>
              <p className="text-muted text-[14px] mb-8">This information is reviewed by our team and shown on your public profile once approved.</p>

              {error && <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>}

              <Field label="Organisation / company name" required>
                <input value={form.orgName} onChange={(e) => u({ orgName: e.target.value })} placeholder="HYROX Australia" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-5">
                <Field label="Contact person" required>
                  <input value={form.contactName} onChange={(e) => u({ contactName: e.target.value })} placeholder="Jane Smith" className={inputCls} />
                </Field>
                <Field label="Phone" required>
                  <input type="tel" value={form.phone} onChange={(e) => u({ phone: e.target.value })} placeholder="+61 4XX XXX XXX" className={inputCls} />
                </Field>
              </div>

              {/* ABN with live lookup */}
              <Field label="ABN" hint="Optional — live lookup available">
                <div className="flex gap-2">
                  <input value={form.abn} onChange={(e) => { u({ abn: e.target.value }); setAbnStatus("idle"); }}
                    placeholder="XX XXX XXX XXX" className={`${inputCls} flex-1`} />
                  <button type="button" onClick={lookupAbn} disabled={!form.abn || abnStatus === "loading"}
                    className="px-4 py-3 bg-dark border border-dark-lighter rounded-md text-muted hover:text-primary hover:border-primary/60 transition-colors disabled:opacity-40 flex items-center gap-2 font-headline text-[12px] uppercase tracking-widest">
                    <Search className="w-4 h-4" /> Verify
                  </button>
                </div>
                {abnStatus === "found"       && <p className="mt-1.5 font-headline text-[11px] uppercase tracking-widest text-primary flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {abnEntity}</p>}
                {abnStatus === "not_found"   && <p className="mt-1.5 font-headline text-[11px] uppercase tracking-widest text-red-400">ABN not found in the register.</p>}
                {abnStatus === "unavailable" && <p className="mt-1.5 font-headline text-[11px] uppercase tracking-widest text-muted">ABR lookup not configured — enter ABN manually.</p>}
              </Field>

              <div className="grid grid-cols-2 gap-5">
                <Field label="Website">
                  <input type="url" value={form.website} onChange={(e) => u({ website: e.target.value })} placeholder="https://yourorg.com.au" className={inputCls} />
                </Field>
                <Field label="Logo URL" hint="Paste image link">
                  <input type="url" value={form.logoUrl} onChange={(e) => u({ logoUrl: e.target.value })} placeholder="https://…/logo.png" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <Field label="Instagram handle">
                  <input value={form.instagram} onChange={(e) => u({ instagram: e.target.value })} placeholder="@yourorg" className={inputCls} />
                </Field>
                <Field label="Facebook page">
                  <input value={form.facebook} onChange={(e) => u({ facebook: e.target.value })} placeholder="facebook.com/yourorg" className={inputCls} />
                </Field>
              </div>
              <Field label="About your organisation" hint={`${form.bio.length}/500`}>
                <textarea rows={4} maxLength={500} value={form.bio} onChange={(e) => u({ bio: e.target.value })}
                  placeholder="Briefly describe the types of events you run and your experience as an event organiser."
                  className={textareaCls} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                Verify your<br /><span className="text-primary">credentials.</span>
              </h1>
              <p className="text-muted text-[14px] mb-2">
                To keep our platform safe, we require evidence of legitimacy before approving organisers.
                Upload your documents to Google Drive, Dropbox or similar and paste the link below.
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-md p-4 mb-6 flex gap-3">
                <ExternalLink className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="font-headline text-[11px] uppercase tracking-widest text-muted-light leading-relaxed">
                  Make sure shared links are accessible by anyone with the link. Google Drive: share → anyone with the link → viewer.
                </p>
              </div>

              {error && <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>}

              <Field label="Public liability insurance" required hint="Required — PDF or image link">
                <input type="url" value={form.insuranceUrl} onChange={(e) => u({ insuranceUrl: e.target.value })}
                  placeholder="https://drive.google.com/…" className={inputCls} />
                <p className="mt-1.5 font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                  Current certificate of currency covering event activities in Australia.
                </p>
              </Field>

              <Field label="Evidence of past events" required hint="Required — link to portfolio or examples">
                <input type="url" value={form.pastEventsUrl} onChange={(e) => u({ pastEventsUrl: e.target.value })}
                  placeholder="https://drive.google.com/… or https://yourorg.com/events" className={inputCls} />
                <p className="mt-1.5 font-headline text-[10px] uppercase tracking-widest text-muted-dark">
                  Event website, results page, photos or a document listing events you&apos;ve run.
                </p>
              </Field>

              <Field label="Certifications" hint="Optional">
                <textarea rows={3} value={form.certifications} onChange={(e) => u({ certifications: e.target.value })}
                  placeholder="e.g. Athletics Australia affiliate, CrossFit HQ licensed affiliate, accredited race director course."
                  className={textareaCls} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-headline text-4xl font-black italic tracking-tighter text-light mb-2">
                Almost there —<br /><span className="text-primary">notifications.</span>
              </h1>
              <p className="text-muted text-[14px] mb-8">
                Choose which emails you&apos;d like to receive. You can change these anytime in your settings.
              </p>

              {error && <div className="mb-5 px-4 py-3 rounded-md bg-red-900/20 border border-red-500/30 text-red-400 font-headline text-[13px]">{error}</div>}

              <div className="space-y-4 mb-8">
                {[
                  { key: "emailOnApprove" as const, title: "Application approved", desc: "Email when your organiser account or an event is approved." },
                  { key: "emailOnReject"  as const, title: "Application update",   desc: "Email when your organiser account or an event requires attention." },
                ].map(({ key, title, desc }) => (
                  <label key={key} className="flex items-start gap-4 p-4 bg-dark border border-dark-lighter rounded-lg cursor-pointer hover:border-primary/40 transition-colors">
                    <input type="checkbox" checked={form[key]} onChange={(e) => u({ [key]: e.target.checked })} className="accent-primary w-4 h-4 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-headline text-[13px] font-bold uppercase tracking-tight text-light">{title}</div>
                      <div className="font-headline text-[11px] uppercase tracking-widest text-muted mt-0.5">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="bg-dark border border-dark-lighter rounded-lg p-5 mb-6">
                <div className="font-headline text-[10px] uppercase tracking-widest text-primary mb-3">Before you submit</div>
                <ul className="space-y-2">
                  {["Organisation details are complete","Insurance document link is active and accessible","Past events evidence is accessible"].map((s, i) => (
                    <li key={i} className="flex items-center gap-2 font-headline text-[12px] uppercase tracking-widest text-muted-light">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-dark-lighter mt-8">
            <button onClick={() => step > 0 ? setStep(step - 1) : router.push("/organiser")}
              className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-2 transition-colors">
              <ArrowLeft className="w-4 h-4" /> {step === 0 ? "Back to sign in" : "Back"}
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => save(false)} disabled={saving}
                className="font-headline text-[13px] font-bold uppercase tracking-widest text-muted hover:text-light px-5 py-3 transition-colors disabled:opacity-40">
                Save draft
              </button>
              {step < steps.length - 1 ? (
                <button onClick={() => setStep(step + 1)}
                  className="bg-machined shadow-machined text-dark font-headline text-[13px] font-bold uppercase tracking-widest px-6 py-3.5 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform">
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
