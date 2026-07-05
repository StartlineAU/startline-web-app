"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Settings, Globe, Lock, Check, X, AlertCircle } from "lucide-react";
import { STATE_OPTIONS } from "@/types";
import { useAuthContext } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user, status } = useAuthContext();

  const [userData, setUserData] = useState<{
    id: string; email: string; name: string | null;
    username: string | null; bio: string | null;
    profilePicUrl: string | null; isPublic: boolean;
    city: string | null; state: string | null;
    organiser: { id: string; orgName: string | null; logoUrl: string | null; verified: boolean } | null;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [usernameError, setUsernameError] = useState("");
  const checkTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const val = editUsername.trim().toLowerCase();
    if (!val || val === userData?.username) { setUsernameStatus("idle"); setUsernameError(""); return; }
    if (val.length < 3) { setUsernameStatus("invalid"); setUsernameError("Username must be at least 3 characters."); return; }
    if (val.length > 30) { setUsernameStatus("invalid"); setUsernameError("Username must be 30 characters or less."); return; }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(val)) { setUsernameStatus("invalid"); setUsernameError("Only lowercase letters, numbers, and hyphens allowed."); return; }
    setUsernameStatus("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/user/profile/check-username?username=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data.available) { setUsernameStatus("valid"); setUsernameError(""); }
        else { setUsernameStatus("invalid"); setUsernameError(data.error || "This username is already taken."); }
      } catch { setUsernameStatus("idle"); setUsernameError(""); }
    }, 400);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [editUsername, userData?.username]);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setUserData(data);
        setEditName(data.name ?? "");
        setEditUsername(data.username ?? "");
        setEditBio(data.bio ?? "");
        setEditIsPublic(data.isPublic);
        setEditCity(data.city ?? "");
        setEditState(data.state ?? "");
      }
    } catch {
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") loadProfile();
    else setProfileLoading(false);
  }, [status, loadProfile]);

  const handleSaveProfile = async () => {
    setEditSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, username: editUsername || null, bio: editBio, isPublic: editIsPublic, city: editCity || null, state: editState || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserData((prev) => prev ? { ...prev, ...data } : prev);
        setEditing(false);
      }
    } catch {
    } finally {
      setEditSaving(false);
    }
  };

  const initial = userData?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "A";

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen bg-dark-darker pt-20">
        <section className="max-w-[1440px] mx-auto px-6 py-24 text-center">
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-4">Sign in to see your profile</h1>
          <p className="text-muted text-sm mb-8">Save events, track registrations, and manage your account.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="bg-dark border-b border-dark-lighter">
        <div className="max-w-[1440px] mx-auto px-6 pt-24 pb-12">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="font-headline text-2xl font-black text-dark">{initial}</span>
            </div>
            <div className="flex-1 min-w-0">
              {profileLoading ? (
                <div className="w-32 h-5 bg-dark-lighter rounded animate-pulse" />
              ) : (
                <>
                  <h1 className="font-headline text-2xl font-black italic tracking-tighter text-light">{userData?.name ?? user?.email}</h1>
                  {userData?.username && <p className="font-headline text-xs uppercase tracking-widest text-muted mt-0.5">@{userData.username}</p>}
                  {userData?.bio && <p className="text-muted text-sm mt-2 max-w-xl leading-relaxed">{userData.bio}</p>}
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1.5 font-headline text-[10px] uppercase tracking-widest text-muted">
                      {userData?.isPublic ? <><Globe className="w-3 h-3 text-primary" /> Public profile</> : <><Lock className="w-3 h-3 text-muted-dark" /> Private profile</>}
                    </span>
                    {userData?.organiser && (
                      <Link href="/organiser/dashboard" className="flex items-center gap-1.5 font-headline text-[10px] uppercase tracking-widest text-primary hover:underline">
                        {userData.organiser.orgName ?? "Organiser Dashboard"}
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setEditing(!editing)}
              className="flex items-center gap-2 h-9 px-4 rounded font-headline text-[11px] font-bold uppercase tracking-widest text-muted bg-transparent border border-dark-lighter hover:border-primary hover:text-primary transition-colors">
              <Settings className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        </div>
      </section>

      {editing && (
        <section className="border-b border-dark-lighter bg-dark/50">
          <div className="max-w-[640px] mx-auto px-6 py-8 space-y-5">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary">Edit profile</h2>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">Full name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">Username</label>
              <div className="relative">
                <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="e.g. johndoe"
                  className={`w-full bg-dark border rounded-md px-4 py-2.5 pr-10 text-[15px] text-light placeholder:text-muted-dark focus:outline-none transition-colors ${usernameStatus === "invalid" ? "border-red-500/50 focus:border-red-500" : usernameStatus === "valid" ? "border-green-500/50 focus:border-green-500" : "border-dark-lighter focus:border-primary"}`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin block" />}
                  {usernameStatus === "valid" && <Check className="w-4 h-4 text-green-500" />}
                  {usernameStatus === "invalid" && <X className="w-4 h-4 text-red-500" />}
                </span>
              </div>
              {usernameError && <p className="flex items-center gap-1 font-headline text-[10px] uppercase tracking-widest text-red-400 mt-1"><AlertCircle className="w-3 h-3" /> {usernameError}</p>}
              {usernameStatus === "idle" && !usernameError && <p className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mt-1">3–30 characters, lowercase letters, numbers, and hyphens only.</p>}
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">Bio</label>
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3}
                className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors resize-none" />
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">City</label>
              <input type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="e.g. Melbourne"
                className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-2.5 text-[15px] text-light placeholder:text-muted-dark focus:border-primary focus:outline-none transition-colors" />
            </div>

            <div>
              <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted block mb-1.5">State</label>
              <select value={editState} onChange={(e) => setEditState(e.target.value)}
                className="w-full bg-dark border border-dark-lighter rounded-md px-4 py-2.5 text-[15px] text-light focus:border-primary focus:outline-none transition-colors">
                <option value="">—</option>
                {STATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <button onClick={() => setEditIsPublic(!editIsPublic)}
                className={`w-10 h-6 rounded-full transition-colors relative ${editIsPublic ? "bg-primary" : "bg-dark-lighter"}`}>
                <div className={`w-4 h-4 rounded-full bg-dark absolute top-1 transition-transform ${editIsPublic ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="font-headline text-[12px] uppercase tracking-widest text-muted">{editIsPublic ? "Public profile" : "Private profile"}</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveProfile} disabled={editSaving || usernameStatus === "invalid" || usernameStatus === "checking"}
                className="bg-machined shadow-machined text-dark font-headline text-[11px] font-bold uppercase tracking-widest py-2.5 px-6 rounded-md flex items-center gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-50">
                {editSaving ? "Saving…" : <><Check className="w-4 h-4" /> Save</>}
              </button>
              <button onClick={() => setEditing(false)} className="font-headline text-[11px] uppercase tracking-widest text-muted hover:text-primary transition-colors px-4">Cancel</button>
            </div>

            <div className="pt-4 border-t border-dark-lighter">
              <label className="font-headline text-[10px] uppercase tracking-widest text-muted-dark block mb-1">User ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[12px] text-muted bg-dark px-3 py-2 rounded-md truncate">{userData?.id ?? ""}</code>
                <button onClick={() => navigator.clipboard.writeText(userData?.id ?? "")} className="font-headline text-[10px] uppercase tracking-widest text-primary hover:underline flex-shrink-0">Copy</button>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
