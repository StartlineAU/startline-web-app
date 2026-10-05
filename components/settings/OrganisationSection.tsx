"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Mail, Move, Phone, Upload } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { Skeleton } from "@/components/ui/skeleton";
import { uploadFile } from "@/lib/upload-client";
import { TYPE_MIMES } from "@/lib/upload-limits";
import {
  ErrorNote, FieldLabel, GroupHeading, SaveFooter, SectionShell, inputCls,
} from "@/components/settings/primitives";

const linkBtnCls = "font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-light flex items-center gap-1 transition-colors disabled:opacity-40";
const Dot = () => <span className="text-white/20 text-xs">·</span>;

// ── ImageEditor ─────────────────────────────────────────────────────────────
// The cover and the logo are the same control at two shapes: pick a file, then
// optionally drag the picture to choose which part shows. Pointer events cover
// mouse, touch and pen alike.

function ImageEditor({
  shape, imageUrl, position, placeholder, uploading, hint,
  onPick, onPositionChange, onPositionCommit, onRemove,
}: {
  shape: "cover" | "logo";
  imageUrl: string; position: string; placeholder: React.ReactNode;
  uploading: boolean; hint?: string;
  onPick: () => void;
  onPositionChange: (p: string) => void;
  onPositionCommit: () => void;
  onRemove: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [reposition, setReposition] = useState(false);
  const active = reposition && Boolean(imageUrl);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    e.preventDefault();
    const [x, y] = position.split(" ").map(v => parseFloat(v));
    dragStart.current = { x: e.clientX, y: e.clientY, px: isNaN(x) ? 50 : x, py: isNaN(y) ? 50 : y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    const x = clamp(start.px + ((e.clientX - start.x) / rect.width)  * -100);
    const y = clamp(start.py + ((e.clientY - start.y) / rect.height) * -100);
    onPositionChange(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  };
  const endDrag = () => { dragStart.current = null; };

  const frame = (
    <div
      ref={frameRef}
      className={`relative overflow-hidden border border-dark-lighter select-none shrink-0
        ${shape === "cover" ? "h-28 w-full rounded-xl bg-dark-light" : "w-24 h-24 rounded-2xl bg-primary"}
        ${active ? "cursor-grab active:cursor-grabbing touch-none" : ""}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={endDrag} onPointerCancel={endDrag}
    >
      {imageUrl
        ? <Image src={imageUrl} alt="" fill draggable={false}
            className={`object-cover pointer-events-none ${shape === "cover" ? "brightness-[.62] saturate-110" : ""}`}
            style={{ objectPosition: position }} sizes={shape === "cover" ? "(max-width: 768px) 100vw, 520px" : "96px"} />
        : placeholder}
      {active && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/60 text-white rounded-lg px-2.5 py-1.5 font-headline text-[11px] font-bold uppercase tracking-wider">
            <Move className="w-3.5 h-3.5" /> {shape === "cover" && "Drag to reposition"}
          </div>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );

  const actions = (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => { setReposition(false); onPick(); }} disabled={uploading} className={linkBtnCls}>
          <Upload className="w-3 h-3" /> {uploading ? "Uploading…" : imageUrl ? "Change photo" : "Upload photo"}
        </button>
        {imageUrl && (
          <>
            <Dot />
            {reposition ? (
              <button type="button" onClick={() => { setReposition(false); onPositionCommit(); }}
                className="font-headline text-[11px] font-bold uppercase tracking-widest bg-primary text-dark px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
                Done
              </button>
            ) : (
              <button type="button" onClick={() => setReposition(true)} className={linkBtnCls}>
                <Move className="w-3 h-3" /> Reposition
              </button>
            )}
            <Dot />
            <button type="button" onClick={() => { setReposition(false); onRemove(); }} disabled={uploading}
              className={linkBtnCls + " hover:text-red-400"}>
              Remove
            </button>
          </>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-dark mt-1">{hint}</p>}
    </div>
  );

  return shape === "cover"
    ? <div className="space-y-2">{frame}{actions}</div>
    : <div className="flex items-start gap-4">{frame}{actions}</div>;
}

// ── Organisation profile form ───────────────────────────────────────────────

interface ProfileForm {
  orgName: string; bio: string; contactName: string;
  contactEmail: string; phone: string;
  logoUrl: string; logoPosition: string; coverImageUrl: string; coverPosition: string;
}

type ImageFields = Pick<ProfileForm, "logoUrl" | "logoPosition" | "coverImageUrl" | "coverPosition">;

const EMPTY_FORM: ProfileForm = {
  orgName: "", bio: "", contactName: "", contactEmail: "",
  phone: "", logoUrl: "", logoPosition: "50% 50%", coverImageUrl: "", coverPosition: "50% 50%",
};

const TITLE = "Organisation profile";
const DESCRIPTION = "How your organisation appears to athletes, and who we contact about your events.";

export default function OrganisationSection() {
  const { notifyProfileSaved } = useSettings();
  const router = useRouter();
  const [form,      setForm]      = useState<ProfileForm>(EMPTY_FORM);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  // The insurance declaration is the owner's to make; the API refuses it from
  // a manager, who sees where it stands.
  const [insuranceDeclared, setInsuranceDeclared] = useState(false);
  const [isOwner,           setIsOwner]           = useState(false);
  const logoRef  = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // A late reply must not land on top of what has been typed since: in
    // development the effect runs twice, and the second fetch did exactly that.
    let cancelled = false;
    fetch("/api/organiser/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        if (!data) { setLoadState("failed"); return; }
        setForm({
          orgName:       data.orgName       ?? "",
          bio:           data.bio           ?? "",
          contactName:   data.contactName   ?? "",
          contactEmail:  data.contactEmail  ?? "",
          phone:         data.phone         ?? "",
          logoUrl:       data.logoUrl       ?? "",
          logoPosition:  data.logoPosition  ?? "50% 50%",
          coverImageUrl: data.coverImageUrl ?? "",
          coverPosition: data.coverPosition ?? "50% 50%",
        });
        setInsuranceDeclared(Boolean(data.insuranceDeclared));
        setIsOwner(data.role === "OWNER");
        setLoadState("ready");
      })
      .catch(() => { if (!cancelled) setLoadState("failed"); });
    return () => { cancelled = true; };
  }, []);

  const patch = (p: Partial<ProfileForm>) => setForm(f => ({ ...f, ...p }));

  const confirmSaved = () => {
    setSaved(true);
    notifyProfileSaved();
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  };

  // Images save on their own, the moment they change, and leave the text
  // fields alone until Save is pressed.
  const saveImage = async (fields: Partial<ImageFields>, failure: string) => {
    setError("");
    try {
      const res = await fetch("/api/organiser/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v || null]))),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? failure); return false; }
      patch(fields);
      confirmSaved();
      return true;
    } catch {
      setError(failure);
      return false;
    }
  };

  const handleUpload = async (file: File, type: "logo" | "cover") => {
    const failure = type === "logo" ? "Logo upload failed." : "Cover upload failed.";
    setUploading(type); setError("");
    try {
      const url = await uploadFile(file, type);
      await saveImage(type === "logo" ? { logoUrl: url } : { coverImageUrl: url }, failure);
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/organiser/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isOwner ? { ...form, insuranceDeclared } : form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Save failed."); return; }
      confirmSaved();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSaving(false); }
  };

  if (loadState === "loading") {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <div className="space-y-6" role="status" aria-label="Loading profile">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="flex gap-4">
            <Skeleton className="h-24 w-24 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2 pt-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </SectionShell>
    );
  }

  if (loadState === "failed") {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <ErrorNote>Your organisation could not be loaded. Close settings and try again.</ErrorNote>
      </SectionShell>
    );
  }

  const initial = (form.orgName || "O").charAt(0).toUpperCase();

  return (
    <SectionShell
      title={TITLE}
      description={DESCRIPTION}
      footer={<SaveFooter saving={saving} saved={saved} disabled={uploading !== null} onSave={handleSave} />}
    >
      <div className="space-y-8">

        {/* Photos */}
        <div>
          <GroupHeading>Photos</GroupHeading>
          <div className="mb-5">
            <FieldLabel label="Cover photo" hint="Recommended 1200×400" />
            <ImageEditor
              shape="cover" imageUrl={form.coverImageUrl} position={form.coverPosition}
              uploading={uploading === "cover"}
              placeholder={
                <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #b3e153 0%, transparent 50%), radial-gradient(circle at 80% 20%, #86efac 0%, transparent 40%)" }} />
              }
              onPick={() => coverRef.current?.click()}
              onPositionChange={pos => patch({ coverPosition: pos })}
              onPositionCommit={() => saveImage({ coverPosition: form.coverPosition }, "Could not save the cover position.")}
              onRemove={() => saveImage({ coverImageUrl: "" }, "Could not remove the cover photo.")}
            />
            <input ref={coverRef} type="file" accept={TYPE_MIMES.cover.join(",")} className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, "cover"); e.target.value = ""; }} />
          </div>
          <div>
            <FieldLabel label="Logo" />
            <ImageEditor
              shape="logo" imageUrl={form.logoUrl} position={form.logoPosition}
              uploading={uploading === "logo"} hint="JPG, PNG or WebP, square recommended."
              placeholder={
                <span className="font-headline font-black italic text-2xl text-dark flex items-center justify-center w-full h-full">{initial}</span>
              }
              onPick={() => logoRef.current?.click()}
              onPositionChange={pos => patch({ logoPosition: pos })}
              onPositionCommit={() => saveImage({ logoPosition: form.logoPosition }, "Could not save the logo position.")}
              onRemove={() => saveImage({ logoUrl: "" }, "Could not remove the logo.")}
            />
            <input ref={logoRef} type="file" accept={TYPE_MIMES.logo.join(",")} className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, "logo"); e.target.value = ""; }} />
          </div>
        </div>

        {/* Organisation */}
        <div>
          <GroupHeading>Organisation</GroupHeading>
          <div className="space-y-4">
            <div>
              <FieldLabel label="Organisation name" required htmlFor="settings-org-name" />
              <input id="settings-org-name" className={inputCls} value={form.orgName}
                onChange={e => patch({ orgName: e.target.value })} placeholder="e.g. Endurance Events Australia" />
            </div>
            <div>
              <FieldLabel label="About" hint={`${form.bio.length}/600`} htmlFor="settings-org-bio" />
              <textarea id="settings-org-bio" className={`${inputCls} resize-none`}
                rows={4} maxLength={600} value={form.bio} onChange={e => patch({ bio: e.target.value })}
                placeholder="Tell athletes what you run and who you are…" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div>
          <GroupHeading>Contact</GroupHeading>
          <div className="space-y-4">
            <div>
              <FieldLabel label="Contact name" required htmlFor="settings-org-contact" />
              <input id="settings-org-contact" className={inputCls} value={form.contactName}
                onChange={e => patch({ contactName: e.target.value })} placeholder="Full name" />
            </div>
            <div>
              <FieldLabel label="Contact email" required htmlFor="settings-org-email" />
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input id="settings-org-email" className={`${inputCls} pl-9`} type="email" value={form.contactEmail}
                  onChange={e => patch({ contactEmail: e.target.value })} placeholder="events@yourorg.com.au" />
              </div>
            </div>
            <div>
              <FieldLabel label="Contact phone" required htmlFor="settings-org-phone" />
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                <input id="settings-org-phone" className={`${inputCls} pl-9`} type="tel" value={form.phone}
                  onChange={e => patch({ phone: e.target.value })} placeholder="+61 4xx xxx xxx" />
              </div>
            </div>
          </div>
        </div>

        {/* Insurance */}
        <div>
          <GroupHeading>Insurance</GroupHeading>
          <p className="text-[12px] text-muted leading-relaxed mb-4">
            To list events on Startline you must hold current public liability insurance of at least{" "}
            <span className="text-muted-light">$10 million per occurrence</span>, from an APRA-registered insurer, covering the
            full duration of each event. Startline does not collect or check certificates: this is your own declaration
            (Terms of Service §5.3). It is needed before you can connect Stripe for payouts.
          </p>
          <label className={`flex items-start gap-3 ${isOwner ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
            <span className="relative shrink-0 mt-0.5">
              <input type="checkbox" className="peer sr-only" checked={insuranceDeclared} disabled={!isOwner}
                onChange={(e) => setInsuranceDeclared(e.target.checked)} />
              <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${insuranceDeclared ? "bg-primary border-primary" : "bg-dark-light border-dark-lighter"}`}>
                {insuranceDeclared && <Check className="w-3.5 h-3.5 text-dark" strokeWidth={3} />}
              </span>
            </span>
            <span className="text-[13px] text-muted leading-relaxed">
              I declare that I currently hold public liability insurance meeting Startline&apos;s minimum requirements, and I
              will maintain this coverage for the full duration of every event I list.
            </span>
          </label>
          {!isOwner && <p className="text-[11px] text-muted-dark mt-3">Only the owner can make this declaration.</p>}
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </SectionShell>
  );
}
