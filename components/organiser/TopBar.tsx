"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CalendarDays, User, LogOut } from "lucide-react";

const NAV = [
  { href: "/organiser/dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { href: "/organiser/listings",  label: "Listings",    icon: CalendarDays    },
  { href: "/organiser/profile",   label: "My Profile",  icon: User            },
];

export default function OrganiserTopBar() {
  const router   = useRouter();
  const pathname = usePathname();
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
          <div className="ml-auto flex items-center gap-2 px-2 shrink-0">
            {displayName && (
              <span className="hidden md:block font-headline text-[12px] font-bold uppercase tracking-widest text-white/40">
                {displayName}
              </span>
            )}
            <div className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
              {initial}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest text-white/50 hover:text-white hover:bg-white/10 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-xl active:translate-y-0 active:scale-100 active:shadow-none will-change-transform transition-all duration-300 ease-out"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}

