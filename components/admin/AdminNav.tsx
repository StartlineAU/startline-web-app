"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Users, Star, LogOut, ShieldCheck,
  UserCircle, ClipboardList, BarChart2, ScrollText, ChevronDown,
} from "lucide-react";

const NAV = [
  { href: "/admin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/admin/events",        label: "Events",        icon: CalendarDays    },
  { href: "/admin/organisers",    label: "Organisers",    icon: Users           },
  { href: "/admin/users",         label: "Users",         icon: UserCircle      },
  { href: "/admin/registrations", label: "Registrations", icon: ClipboardList   },
  { href: "/admin/reviews",       label: "Reviews",       icon: Star            },
  { href: "/admin/analytics",     label: "Analytics",     icon: BarChart2       },
  { href: "/admin/audit",         label: "Audit log",     icon: ScrollText      },
];

export default function AdminNav() {
  const router   = useRouter();
  const pathname = usePathname();

  const [email,    setEmail]    = useState("");
  const [navOpen,  setNavOpen]  = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const navRef  = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import("aws-amplify/auth")
      .then(({ fetchAuthSession }) => fetchAuthSession())
      .then((session) => {
        const e = session.tokens?.idToken?.payload?.["email"] as string | undefined;
        const s = session.tokens?.accessToken?.payload?.["username"] as string | undefined;
        setEmail(e ?? s ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current  && !navRef.current.contains(e.target  as Node)) setNavOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setUserOpen(false);
    const { signOut } = await import("aws-amplify/auth");
    await signOut();
    router.push("/admin/login");
  };

  const activePage = NAV.find(
    ({ href }) => pathname === href || (pathname?.startsWith(href + "/") ?? false),
  );
  const ActiveIcon = activePage?.icon ?? LayoutDashboard;

  const initial      = email ? email.charAt(0).toUpperCase() : "A";
  const displayEmail = email.length > 24 ? email.slice(0, 24) + "…" : email;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-dark-darker/80 backdrop-blur-xl border-b border-white/[0.05]">
      <div className="flex items-center justify-between h-full max-w-[1200px] mx-auto px-4 sm:px-6 gap-4">

        {/* Logo */}
        <Link href="/" className="shrink-0 py-1 flex items-center gap-2">
          <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
          <span className="hidden sm:flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-white/30 border border-white/15 rounded px-1.5 py-0.5">
            <ShieldCheck className="w-2.5 h-2.5" /> Admin
          </span>
        </Link>

        {/* Nav dropdown */}
        <div ref={navRef} className="relative">
          <button
            onClick={() => { setNavOpen((o) => !o); setUserOpen(false); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest transition-colors
              ${navOpen ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}
          >
            <ActiveIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:block">{activePage?.label ?? "Menu"}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${navOpen ? "rotate-180" : ""}`} />
          </button>

          {navOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-dark-darker border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
              <div className="py-1.5">
                {NAV.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || (pathname?.startsWith(href + "/") ?? false);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setNavOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 font-headline text-[12px] font-bold uppercase tracking-widest transition-colors
                        ${isActive
                          ? "text-primary bg-primary/10"
                          : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                        }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-white/40"}`} />
                      {label}
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div ref={userRef} className="relative shrink-0">
          <button
            onClick={() => { setUserOpen((o) => !o); setNavOpen(false); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
              {initial}
            </div>
            {displayEmail && (
              <span className="hidden lg:block font-headline text-[12px] font-bold uppercase tracking-widest text-white/70">
                {displayEmail}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${userOpen ? "rotate-180" : ""}`} />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-dark-darker border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.08]">
                <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-white/40 mb-0.5">
                  Admin account
                </div>
                {email && (
                  <div className="font-headline text-[12px] text-white/70 truncate">{email}</div>
                )}
              </div>
              <div className="py-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 font-headline text-[12px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
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
