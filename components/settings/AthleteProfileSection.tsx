"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, Check, Upload, X } from "lucide-react";
import { uploadFile } from "@/lib/upload-client";
import { TYPE_MIMES } from "@/lib/upload-limits";
import { useSettings } from "@/context/SettingsContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ErrorNote, FieldLabel, GroupHeading, SaveFooter, SectionShell, Switch, inputCls,
} from "@/components/settings/primitives";

type ProfileDraft = {
  username: string;
  bio: string;
  isPublic: boolean;
  profilePicUrl: string;
};

const EMPTY: ProfileDraft = {
  username: "", bio: "", isPublic: false, profilePicUrl: "",
};

const TITLE = "Profile";
const DESCRIPTION = "Your public athlete profile: what other athletes see.";

export default function AthleteProfileSection() {
  const router   = useRouter();
  const pathname = usePathname();
  const { notifyProfileSaved } = useSettings();

  const [form, setForm] = useState<ProfileDraft>(EMPTY);
  // The handle as last saved: the availability check skips it, and a change
  // away from it moves the profile page to its new address.
  const [currentUsername, setCurrentUsername] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [usernameError,  setUsernameError]  = useState("");
  const avatarRef  = useRef<HTMLInputElement>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    // A late reply must not land on top of what has been typed since: in
    // development the effect runs twice, and the second fetch did exactly that.
    let cancelled = false;
    fetch("/api/user/profile")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return;
        if (!data) { setLoadState("failed"); return; }
        setForm({
          username:              data.username ?? "",
          bio:                   data.bio ?? "",
          isPublic:              Boolean(data.isPublic),
          profilePicUrl:         data.profilePicUrl ?? "",
        });
        setCurrentUsername(data.username ?? "");
        setLoadState("ready");
      })
      .catch(() => { if (!cancelled) setLoadState("failed"); });
    return () => { cancelled = true; };
  }, []);

  const usernameValidation = useMemo(() => {
    const val = form.username.trim().toLowerCase();
    if (!val || val === currentUsername) return { status: "idle" as const, error: "" };
    if (val.length < 3) return { status: "invalid" as const, error: "Username must be at least 3 characters." };
    if (val.length > 30) return { status: "invalid" as const, error: "Username must be 30 characters or less." };
    if (/^-|-$/.test(val)) {
      return { status: "invalid" as const, error: "Username cannot start or end with a hyphen." };
    }
    if (!/^[a-z0-9-]+$/.test(val)) {
      return { status: "invalid" as const, error: "No spaces or symbols. Use letters, numbers and hyphens." };
    }
    return null;
  }, [form.username, currentUsername]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (loadState !== "ready") return;
    if (usernameValidation) {
      setUsernameStatus(usernameValidation.status);
      setUsernameError(usernameValidation.error);
      return;
    }
    setUsernameStatus("checking");
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/user/profile/check-username?username=${encodeURIComponent(form.username.trim().toLowerCase())}`
        );
        const data = await res.json();
        if (data.available) {
          setUsernameStatus("valid");
          setUsernameError("");
        } else {
          setUsernameStatus("invalid");
          setUsernameError(data.error || "This username is already taken.");
        }
      } catch {
        setUsernameStatus("idle");
        setUsernameError("");
      }
    }, 400);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [loadState, usernameValidation, form.username]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const patch = (p: Partial<ProfileDraft>) => setForm(f => ({ ...f, ...p }));

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    setError("");
    try {
      patch({ profilePicUrl: await uploadFile(file, "avatar") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (usernameStatus === "invalid" || usernameStatus === "checking") return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username || null,
          bio: form.bio,
          isPublic: form.isPublic,
          profilePicUrl: form.profilePicUrl || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save profile.");
        return;
      }
      const savedUsername: string = data.username ?? form.username;
      // The profile page lives at /profile/<username>, so a new handle is a new URL.
      const onOwnProfile = currentUsername !== "" && pathname === `/profile/${currentUsername}`;
      if (onOwnProfile && savedUsername && savedUsername !== currentUsername) {
        router.replace(`/profile/${savedUsername}`);
      } else {
        router.refresh();
      }
      setCurrentUsername(savedUsername);
      setUsernameStatus("idle");
      notifyProfileSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadState === "loading") {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <div className="space-y-6" role="status" aria-label="Loading profile">
          <div className="flex gap-4">
            <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2 pt-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </SectionShell>
    );
  }

  if (loadState === "failed") {
    return (
      <SectionShell title={TITLE} description={DESCRIPTION}>
        <ErrorNote>Your profile could not be loaded. Close settings and try again.</ErrorNote>
      </SectionShell>
    );
  }

  const initialLetter = (form.username || "A").charAt(0).toUpperCase();

  return (
    <SectionShell
      title={TITLE}
      description={DESCRIPTION}
      footer={
        <SaveFooter saving={saving} saved={saved} onSave={handleSave}
          disabled={avatarUploading || usernameStatus === "invalid" || usernameStatus === "checking"} />
      }
    >
      <div className="space-y-8">
        <div>
          <GroupHeading>Photo</GroupHeading>
          <FieldLabel label="Profile photo" />
          <div className="flex items-start gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-dark-lighter bg-dark-light shrink-0">
              {form.profilePicUrl ? (
                <Image src={form.profilePicUrl} alt="Profile" fill className="object-cover" sizes="80px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-headline text-2xl font-black italic text-primary">
                  {initialLetter}
                </div>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => avatarRef.current?.click()} disabled={avatarUploading}
                  className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors disabled:opacity-40 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> {avatarUploading ? "Uploading…" : form.profilePicUrl ? "Change photo" : "Upload photo"}
                </button>
                {form.profilePicUrl && (
                  <>
                    <span className="text-white/20 text-xs">·</span>
                    <button type="button" onClick={() => patch({ profilePicUrl: "" })}
                      className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-red-400 transition-colors">
                      Remove
                    </button>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-dark mt-1">JPG, PNG or WebP, square recommended.</p>
            </div>
          </div>
          <input ref={avatarRef} type="file" accept={TYPE_MIMES.avatar.join(",")} className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarUpload(file);
              e.target.value = "";
            }} />
        </div>

        <div>
          <GroupHeading>Public profile</GroupHeading>
          <div className="space-y-4">
            <div>
              <FieldLabel label="Username" hint="Shown on your profile" htmlFor="settings-username" />
              <div className="relative">
                <input
                  id="settings-username"
                  className={`${inputCls} pr-10 ${
                    usernameStatus === "invalid"
                      ? "border-red-500/50 focus:border-red-500"
                      : usernameStatus === "valid"
                        ? "border-green-500/50 focus:border-green-500"
                        : ""
                  }`}
                  value={form.username}
                  // A username is one word, so a typed space becomes the hyphen
                  // it would have to be anyway (issue #347).
                  onChange={(e) => patch({ username: e.target.value.toLowerCase().replace(/-?\s+/g, "-") })}
                  placeholder="e.g. john-doe"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && (
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin block" />
                  )}
                  {usernameStatus === "valid" && <Check className="w-4 h-4 text-green-500" />}
                  {usernameStatus === "invalid" && <X className="w-4 h-4 text-red-500" />}
                </span>
              </div>
              {usernameError ? (
                <p className="flex items-center gap-1 font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1">
                  <AlertCircle className="w-3 h-3" /> {usernameError}
                </p>
              ) : (
                <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-1">
                  One word, no spaces. Letters, numbers and hyphens.
                </p>
              )}
            </div>
            <div>
              <FieldLabel label="Bio" hint={`${form.bio.length}/300`} htmlFor="settings-bio" />
              <textarea id="settings-bio" className={`${inputCls} resize-none`} rows={3} maxLength={300}
                value={form.bio} onChange={(e) => patch({ bio: e.target.value })}
                placeholder="A short line about you as an athlete…" />
            </div>
            <div className="flex items-center justify-between gap-4 border border-dark-lighter rounded-lg p-4">
              <div>
                <div id="settings-public-label" className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">
                  Visible to other athletes
                </div>
                <div className="text-[11px] text-muted-dark mt-0.5">
                  When on, anyone can view your profile at /profile/your-username.
                </div>
              </div>
              <Switch checked={form.isPublic} onChange={() => patch({ isPublic: !form.isPublic })} labelledBy="settings-public-label" />
            </div>
          </div>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </SectionShell>
  );
}
