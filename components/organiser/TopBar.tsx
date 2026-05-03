"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrganiserTopBar() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [initial, setInitial] = useState("O");
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    fetch("/api/organiser/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const name = data.orgName || data.contactName || data.email || "";
        setOrgName(data.orgName || data.contactName || data.email || "");
        if (name) setInitial(name.charAt(0).toUpperCase());
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleLogout = async () => {
    const { signOut } = await import("aws-amplify/auth");
    await signOut();
    router.push("/organiser");
  };

  const displayName = loaded
    ? (orgName.length > 18 ? orgName.slice(0, 18) + "…" : orgName) || null
    : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-16 bg-dark border-b border-dark-lighter flex items-center">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 flex items-center justify-between">
        <Link href="/organiser/dashboard" className="flex items-center gap-2 py-2">
          <Image src="/images/logo-title.svg" alt="Startline" width={140} height={36} className="h-8 w-auto" />
        </Link>

        <div className="flex items-center gap-1">
          <button
            className="w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-dark-light/60 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 group h-11 px-2 rounded-lg hover:bg-dark-light/60 transition-colors"
            aria-label="Account menu"
          >
            <div className="w-8 h-8 rounded-full bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
              {initial}
            </div>
            {!loaded ? (
              <span className="hidden md:inline w-24 h-3.5 rounded bg-dark-lighter animate-pulse" />
            ) : displayName ? (
              <span className="font-headline text-[13px] font-bold uppercase tracking-tight text-light group-hover:text-primary hidden md:inline transition-colors">
                {displayName}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </nav>
  );
}
