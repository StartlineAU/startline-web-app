"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, User, LogOut, CheckCircle } from "lucide-react";

const NAV = [
  { href: "/organiser/dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { href: "/organiser/listings",  label: "Event Listings", icon: CalendarDays    },
  { href: "/organiser/profile",   label: "My Profile",     icon: User            },
];

export default function OrganiserSidebar() {
  const pathname = usePathname();
  const [orgName,  setOrgName]  = useState("");
  const [initial,  setInitial]  = useState("O");
  const [email,    setEmail]    = useState("");

  useEffect(() => {
    fetch("/api/organiser/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const name = data.orgName || data.contactName || "";
        const fallbackInitial = (name || data.email || "O").charAt(0).toUpperCase();
        setEmail(data.email ?? "");
        setOrgName(name);
        setInitial(fallbackInitial);
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-dark-lighter bg-dark min-h-[calc(100vh-64px)] p-4">
      {/* Org header */}
      <div className="px-2 pt-2 pb-5 border-b border-dark-lighter mb-4">
        <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-2">Signed in as</div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-md bg-primary text-dark font-headline font-black italic flex items-center justify-center text-lg shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            {(orgName || email) ? (
              <>
                <div className="font-headline text-[14px] font-bold text-light truncate">
                  {orgName || email}
                </div>
                <div className="flex items-center gap-1 font-headline text-[10px] text-primary uppercase tracking-widest mt-0.5">
                  {orgName ? (
                    <><CheckCircle className="w-3 h-3" /> Verified</>
                  ) : (
                    "Profile incomplete"
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="h-3 w-28 rounded bg-dark-lighter animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-dark-lighter animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="space-y-1 flex-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (pathname?.startsWith(href + "/") ?? false);
          return (
            <Link key={href} href={href}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-md font-headline text-[14px] font-bold transition-colors
                ${isActive
                  ? "bg-dark-light text-light nav-active"
                  : "text-muted hover:text-light hover:bg-dark-light/50"
                }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <Link href="/organiser"
        className="flex items-center gap-3 px-4 py-3 rounded-md font-headline text-[13px] font-bold text-muted hover:text-primary hover:bg-dark-light/50 transition-colors">
        <LogOut className="w-5 h-5" /> Sign out
      </Link>
    </aside>
  );
}
