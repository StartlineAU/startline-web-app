"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, Star, LogOut, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/admin/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/admin/events",     label: "Events",     icon: CalendarDays    },
  { href: "/admin/organisers", label: "Organisers", icon: Users           },
  { href: "/admin/reviews",    label: "Reviews",    icon: Star            },
];

export default function AdminNav() {
  const router   = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [open,  setOpen]  = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import("aws-amplify/auth")
      .then(({ fetchAuthSession }) => fetchAuthSession())
      .then((session) => {
        const sub = session.tokens?.accessToken?.payload?.["username"] as string | undefined;
        const e   = session.tokens?.idToken?.payload?.["email"] as string | undefined;
        if (e) setEmail(e);
        else if (sub) setEmail(sub);
      })
      .catch(() => {});
  }, []);

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
    router.push("/admin/login");
  };

  const initial = email ? email.charAt(0).toUpperCase() : "A";
  const displayEmail = email.length > 22 ? email.slice(0, 22) + "…" : email;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-dark-darker/80 backdrop-blur-xl border-b border-white/[0.05]">
      <div className="flex items-center justify-between h-full max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Logo + Admin badge */}
        <Link href="/" className="shrink-0 py-1 flex items-center gap-2">
          <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
          <span className="hidden sm:flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/30 border border-white/15 rounded px-1.5 py-0.5">
            <ShieldCheck className="w-2.5 h-2.5" /> Admin
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (pathname?.startsWith(href + "/") ?? false);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-150
                  ${isActive
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* User */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
              {initial}
            </div>
            {displayEmail && (
              <span className="hidden md:block font-headline text-[12px] font-bold uppercase tracking-widest text-white/70">
                {displayEmail}
              </span>
            )}
            <svg
              className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-dark-darker/95 backdrop-blur-xl border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-white/40">
                  Admin account
                </div>
                {email && (
                  <div className="font-headline text-[12px] text-white/70 mt-0.5 truncate">{email}</div>
                )}
              </div>

              <div className="border-t border-white/10 py-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
