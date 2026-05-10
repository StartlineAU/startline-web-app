"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CalendarDays, User, LogOut, Plus, Settings } from "lucide-react";

const NAV = [
  { href: "/organiser/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/organiser/listings",  label: "Listings",   icon: CalendarDays    },
  { href: "/organiser/profile",   label: "My Profile", icon: User            },
];

const MENU = [
  { href: "/organiser/profile",     label: "My Profile",    icon: User        },
  { href: "/organiser/new-listing", label: "Post an Event", icon: Plus        },
  { href: "/organiser/profile",     label: "Settings",      icon: Settings    },
];

export default function OrganiserTopBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [orgName,  setOrgName]  = useState("");
  const [initial,  setInitial]  = useState("O");
  const [loaded,   setLoaded]   = useState(false);
  const [open,     setOpen]     = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/organiser/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const name = data.orgName || data.contactName || data.email || "";
        setOrgName(name);
        if (name) setInitial(name.charAt(0).toUpperCase());
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    const { signOut } = await import("aws-amplify/auth");
    await signOut();
    router.push("/organiser");
  };

  const displayName = loaded
    ? (orgName.length > 18 ? orgName.slice(0, 18) + "…" : orgName) || null
    : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center pointer-events-none">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6">

        {/* Single pill */}
        <div className="pointer-events-auto bg-[#0f0f0f] rounded-xl shadow-lg h-12 flex items-center px-2 relative">

          {/* Logo — left */}
          <Link href="/organiser/dashboard" className="shrink-0 px-3 py-2">
            <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
          </Link>

          {/* Nav links — absolute centre */}
          <div className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (pathname?.startsWith(href + "/") ?? false);
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none will-change-transform transition-all duration-300 ease-out
                    ${isActive
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:text-white hover:bg-white/10"
                    }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* User — right */}
          <div ref={menuRef} className="ml-auto relative shrink-0">
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
                {initial}
              </div>
              {displayName && (
                <span className="hidden md:block font-headline text-[12px] font-bold uppercase tracking-widest text-white/70">
                  {displayName}
                </span>
              )}
              <svg className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-52 bg-[#0f0f0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                {/* Account info */}
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-white/40">Account</div>
                  {displayName && (
                    <div className="font-headline text-[13px] font-bold text-white mt-0.5 truncate">{orgName}</div>
                  )}
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  {MENU.map(({ href, label, icon: Icon }) => (
                    <Link key={label} href={href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </div>

                {/* Sign out */}
                <div className="border-t border-white/10 py-1.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors">
                    <LogOut className="w-4 h-4 shrink-0" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
