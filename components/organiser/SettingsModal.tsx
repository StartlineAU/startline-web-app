"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  X, ChevronRight, Upload, Camera, Move, Mail, Phone,
  CheckCircle, User, Lock, Bell, CreditCard, Cookie, Trash2,
} from "lucide-react";
import { useSettings, type SettingsSection } from "@/context/SettingsContext";

// ── shared form primitives ──────────────────────────────────────────────────

const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-lime-500 focus:outline-none transition-colors";

function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-700">
        {label}{required && <span className="text-lime-600 ml-0.5">*</span>}
      </label>
      {hint && <span className="font-headline text-[10px] uppercase tracking-widest text-gray-400">{hint}</span>}
    </div>
  );
}

// ── CoverEditor ─────────────────────────────────────────────────────────────

function CoverEditor({
  imageUrl, position, uploading, onUpload, onPositionChange, onRemove, fileRef,
}: {
  imageUrl: string; position: string; uploading: boolean;
  onUpload: (f: File) => void; onPositionChange: (p: string) => void;
  onRemove: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging,   setDragging]   = useState(false);
  const [reposition, setReposition] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const parsePos = (pos: string) => {
    const [x, y] = pos.split(" ").map(v => parseFloat(v));
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!reposition || !imageUrl) return;
    e.preventDefault();
    const { x, y } = parsePos(position);
    dragStart.current = { x: e.clientX, y: e.clientY, px: x, py: y };
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx   = ((e.clientX - dragStart.current.x) / rect.width)  * -100;
    const dy   = ((e.clientY - dragStart.current.y) / rect.height) * -100;
    const newX = Math.min(100, Math.max(0, dragStart.current.px + dx));
    const newY = Math.min(100, Math.max(0, dragStart.current.py + dy));
    onPositionChange(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
  };
  const onMouseUp = () => setDragging(false);

  if (!imageUrl) return (
    <div
      className="relative h-28 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 cursor-pointer"
      onClick={() => fileRef.current?.click()}
    >
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/90 rounded-lg px-3 py-2 flex items-center gap-2 font-headline text-[11px] font-bold uppercase tracking-widest text-gray-700">
          {uploading
            ? <><div className="w-3.5 h-3.5 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" /> Uploading…</>
            : <><Upload className="w-3.5 h-3.5" /> Upload cover</>}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div
        ref={containerRef}
        className={`relative h-28 rounded-xl overflow-hidden border border-gray-200 select-none ${reposition ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        <img src={imageUrl} alt="Cover" className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: position }} draggable={false} />
        {reposition && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/60 text-white rounded-lg px-3 py-1.5 font-headline text-[11px] font-bold uppercase tracking-wider">
              <Move className="w-3.5 h-3.5" /> Drag to reposition
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        {reposition ? (
          <button onClick={() => setReposition(false)}
            className="font-headline text-[11px] font-bold uppercase tracking-widest bg-lime-400 text-gray-900 px-3 py-1.5 rounded-md hover:bg-lime-500 transition-colors">
            Done
          </button>
        ) : (
          <button onClick={() => setReposition(true)}
            className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
            <Move className="w-3 h-3" /> Reposition
          </button>
        )}
        <span className="text-gray-300 text-xs">·</span>
        <button onClick={() => { setReposition(false); fileRef.current?.click(); }} disabled={uploading}
          className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors disabled:opacity-40">
          <Upload className="w-3 h-3" /> {uploading ? "Uploading…" : "Change photo"}
        </button>
      </div>
    </div>
  );
}

// ── LogoEditor ──────────────────────────────────────────────────────────────

function LogoEditor({
  imageUrl, position, initial, uploading, onUpload, onPositionChange, fileRef,
}: {
  imageUrl: string; position: string; initial: string; uploading: boolean;
  onUpload: (f: File) => void; onPositionChange: (p: string) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reposition, setReposition] = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const parsePos = (pos: string) => {
    const [x, y] = pos.split(" ").map(v => parseFloat(v));
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!reposition || !imageUrl) return;
    e.preventDefault();
    const { x, y } = parsePos(position);
    dragStart.current = { x: e.clientX, y: e.clientY, px: x, py: y };
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx   = ((e.clientX - dragStart.current.x) / rect.width)  * -100;
    const dy   = ((e.clientY - dragStart.current.y) / rect.height) * -100;
    const newX = Math.min(100, Math.max(0, dragStart.current.px + dx));
    const newY = Math.min(100, Math.max(0, dragStart.current.py + dy));
    onPositionChange(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
  };
  const onMouseUp = () => setDragging(false);

  return (
    <div className="flex items-start gap-4">
      <div
        ref={containerRef}
        className={`relative w-24 h-24 rounded-2xl overflow-hidden bg-lime-400 border border-gray-200 shrink-0 select-none
          ${reposition && imageUrl ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        {imageUrl
          ? <img src={imageUrl} alt="Logo" className="w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: position }} draggable={false} />
          : <span className="font-headline font-black italic text-2xl text-gray-900 flex items-center justify-center w-full h-full">{initial}</span>}
        {reposition && imageUrl && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
            <Move className="w-4 h-4 text-white" />
          </div>
        )}
        {!reposition && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center"
            onClick={() => !imageUrl && fileRef.current?.click()}>
            {uploading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setReposition(false); fileRef.current?.click(); }} disabled={uploading}
            className="font-headline text-[12px] font-bold uppercase tracking-widest text-gray-700 hover:text-lime-600 transition-colors disabled:opacity-40 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Upload new photo"}
          </button>
          {imageUrl && (
            <>
              <span className="text-gray-300 text-xs">·</span>
              {reposition ? (
                <button onClick={() => setReposition(false)}
                  className="font-headline text-[12px] font-bold uppercase tracking-widest bg-lime-400 text-gray-900 px-2.5 py-1 rounded-md hover:bg-lime-500 transition-colors">
                  Done
                </button>
              ) : (
                <button onClick={() => setReposition(true)}
                  className="font-headline text-[12px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
                  <Move className="w-3 h-3" /> Reposition
                </button>
              )}
            </>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">PNG or JPG, square recommended.</p>
      </div>
    </div>
  );
}

// ── Personal information form ────────────────────────────────────────────────

interface ProfileForm {
  orgName: string; bio: string; contactName: string;
  contactEmail: string; phone: string; facebook: string;
  logoUrl: string; logoPosition: string; coverImageUrl: string; coverPosition: string;
}

const EMPTY_FORM: ProfileForm = {
  orgName: "", bio: "", contactName: "", contactEmail: "",
  phone: "", facebook: "", logoUrl: "", logoPosition: "50% 50%", coverImageUrl: "", coverPosition: "50% 50%",
};

function PersonalInfoForm() {
  const { notifyProfileSaved } = useSettings();
  const [form,           setForm]           = useState<ProfileForm>(EMPTY_FORM);
  const [loadingForm,    setLoadingForm]     = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState("");
  const [logoUploading,  setLogoUploading]  = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const logoRef  = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoadingForm(true);
    fetch("/api/organiser/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setForm({
          orgName:       data.orgName       ?? "",
          bio:           data.bio           ?? "",
          contactName:   data.contactName   ?? "",
          contactEmail:  data.contactEmail  ?? "",
          phone:         data.phone         ?? "",
          facebook:      data.facebook      ?? "",
          logoUrl:       data.logoUrl       ?? "",
          logoPosition:  data.logoPosition  ?? "50% 50%",
          coverImageUrl: data.coverImageUrl ?? "",
          coverPosition: data.coverPosition ?? "50% 50%",
        });
      })
      .catch(() => {})
      .finally(() => setLoadingForm(false));
  }, []);

  const patch = (p: Partial<ProfileForm>) => setForm(f => ({ ...f, ...p }));

  const uploadImage = async (file: File, type: "logo" | "cover") => {
    const fd = new FormData();
    fd.append("file", file); fd.append("type", type);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed.");
    const { fileUrl } = await res.json();
    return fileUrl as string;
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const url = await uploadImage(file, "logo");
      const updated = { ...form, logoUrl: url };
      await fetch("/api/organiser/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      patch({ logoUrl: url });
    } catch { setError("Logo upload failed."); }
    finally { setLogoUploading(false); }
  };

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true);
    try {
      const url = await uploadImage(file, "cover");
      patch({ coverImageUrl: url });
    } catch { setError("Cover upload failed."); }
    finally { setCoverUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/organiser/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed."); return; }
      setSaved(true);
      notifyProfileSaved();
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  };

  const initial = (form.orgName || "O").charAt(0).toUpperCase();

  if (loadingForm) return (
    <div className="py-10 text-center">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Photos */}
      <div>
        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-4">Photos</div>
        <div className="mb-4">
          <FieldLabel label="Cover photo" hint="Recommended 1200×400" />
          <CoverEditor
            imageUrl={form.coverImageUrl} position={form.coverPosition}
            uploading={coverUploading} onUpload={handleCoverUpload}
            onPositionChange={pos => patch({ coverPosition: pos })} fileRef={coverRef}
          />
          <input ref={coverRef} type="file" accept="image/*" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
        </div>
        <div>
          <FieldLabel label="Profile photo" />
          <LogoEditor
            imageUrl={form.logoUrl} position={form.logoPosition} initial={initial}
            uploading={logoUploading} onUpload={handleLogoUpload}
            onPositionChange={pos => patch({ logoPosition: pos })} fileRef={logoRef}
          />
          <input ref={logoRef} type="file" accept="image/*" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
        </div>
      </div>

      {/* Organisation */}
      <div>
        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-4">Organisation</div>
        <div className="space-y-4">
          <div>
            <FieldLabel label="Organisation name" required />
            <input className={inputCls} value={form.orgName} onChange={e => patch({ orgName: e.target.value })} placeholder="e.g. Endurance Events Australia" />
          </div>
          <div>
            <FieldLabel label="About" hint={`${form.bio.length}/600`} />
            <textarea className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-lime-500 focus:outline-none transition-colors resize-none"
              rows={4} maxLength={600} value={form.bio} onChange={e => patch({ bio: e.target.value })}
              placeholder="Tell athletes what you run and who you are…" />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div>
        <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-4">Contact</div>
        <div className="space-y-4">
          <div>
            <FieldLabel label="Contact name" required />
            <input className={inputCls} value={form.contactName} onChange={e => patch({ contactName: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <FieldLabel label="Contact email" required />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={`${inputCls} pl-9`} type="email" value={form.contactEmail}
                onChange={e => patch({ contactEmail: e.target.value })} placeholder="events@yourorg.com.au" />
            </div>
          </div>
          <div>
            <FieldLabel label="Phone" />
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={`${inputCls} pl-9`} type="tel" value={form.phone}
                onChange={e => patch({ phone: e.target.value })} placeholder="+61 4xx xxx xxx" />
            </div>
          </div>
        </div>
      </div>

      {/* Save footer */}
      <div className="pt-2 flex items-center justify-between gap-4 border-t border-gray-100">
        <div className="font-headline text-[11px] uppercase tracking-widest">
          {saved && <span className="text-lime-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Saved</span>}
          {error && <span className="text-red-500 text-[12px]">{error}</span>}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-gray-900 text-white font-headline text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
          <CheckCircle className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── Section content ──────────────────────────────────────────────────────────

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "personal":
      return <PersonalInfoForm />;
    case "security":
      return (
        <div>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
            Password changes are handled via your Cognito account. Use &ldquo;Forgot password&rdquo; on the sign-in page to reset.
          </p>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Password</div>
            <div className="text-[13px] text-gray-500">Reset via the sign-in page using &ldquo;Forgot password&rdquo;.</div>
          </div>
        </div>
      );
    case "notifications":
      return (
        <div>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
            You receive notifications when events are approved or rejected, and when new registrations come in.
          </p>
          <div className="space-y-1">
            {[
              { label: "Event approved",   desc: "When your event is approved by admin"      },
              { label: "Event rejected",   desc: "When your event is rejected with feedback" },
              { label: "New registration", desc: "When an athlete registers for your event"  },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-gray-700">{label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{desc}</div>
                </div>
                <div className="w-8 h-4 bg-lime-400 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      );
    case "payments":
      return (
        <div>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
            Manage your Stripe Express account for payouts, view payout history, and update banking details.
          </p>
          <Link href="/organiser/payments"
            className="inline-flex items-center gap-2 border border-lime-400 bg-lime-50 text-lime-700 font-headline text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-md hover:bg-lime-100 transition-colors">
            Manage payments <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      );
    case "cookies":
      return (
        <div>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
            Startline uses essential cookies to keep you signed in. No advertising or tracking cookies are used.
          </p>
          <div className="space-y-1">
            {[
              { label: "Essential cookies", desc: "Required for the platform to function",       enabled: true,  locked: true  },
              { label: "Analytics",         desc: "Help us understand how the platform is used", enabled: false, locked: false },
            ].map(({ label, desc, enabled, locked }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-gray-700">{label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{desc}</div>
                </div>
                <div className={`w-8 h-4 rounded-full shrink-0 ${enabled ? "bg-lime-400" : "bg-gray-200"} ${locked ? "opacity-50 cursor-not-allowed" : ""}`} />
              </div>
            ))}
          </div>
        </div>
      );
  }
}

const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: "personal",      label: "Personal information", icon: User       },
  { id: "security",      label: "Login & security",     icon: Lock       },
  { id: "notifications", label: "Notifications",        icon: Bell       },
  { id: "payments",      label: "Payments",             icon: CreditCard },
  { id: "cookies",       label: "Cookies",              icon: Cookie     },
];

// ── Modal ────────────────────────────────────────────────────────────────────

export default function SettingsModal() {
  const { isOpen, section, setSection, close } = useSettings();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const active = SECTIONS.find(s => s.id === section)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

      <div className="relative w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-2xl flex overflow-hidden modal-in"
        style={{ maxHeight: "85vh" }}>

        {/* Close */}
        <button onClick={close}
          className="absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
          aria-label="Close settings">
          <X className="w-4 h-4" />
        </button>

        {/* Left sidebar */}
        <div className="w-52 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50 rounded-l-2xl">
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-gray-400">Settings</div>
          </div>
          <nav className="py-2 flex-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${section === id
                    ? "bg-white text-gray-900 border-r-2 border-r-lime-500"
                    : "text-gray-500 hover:text-gray-900 hover:bg-white/60"}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="font-headline text-[11px] font-bold uppercase tracking-widest">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="px-6 py-5 border-b border-gray-200 shrink-0">
            <h2 className="font-headline text-[22px] font-black italic tracking-tight text-gray-900">
              {active.label}
            </h2>
          </div>
          <div className="px-6 py-5">
            <SectionContent section={section} />
          </div>
        </div>

      </div>
    </div>
  );
}
