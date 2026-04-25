"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, User, LogOut, CheckCircle, ArrowRight } from "lucide-react";

const NAV = [
  { href: "/organiser/dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { href: "/organiser/listings",  label: "Event Listings", icon: CalendarDays    },
  { href: "/organiser/profile",   label: "My Profile",     icon: User            },
];

export default function OrganiserSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-dark-lighter bg-dark min-h-[calc(100vh-64px)] p-4">
      <div className="px-2 pt-2 pb-5 border-b border-dark-lighter mb-4">
        <div className="font-headline text-[10px] uppercase tracking-widest text-muted-dark mb-2">Signed in as</div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-md bg-primary text-dark font-headline font-black italic flex items-center justify-center text-lg shrink-0">
            H
          </div>
          <div className="min-w-0">
            <div className="font-headline text-[14px] font-bold text-light truncate">HYROX Australia</div>
            <div className="flex items-center gap-1 font-headline text-[10px] text-primary uppercase tracking-widest mt-0.5">
              <CheckCircle className="w-3 h-3" /> Verified
            </div>
          </div>
        </div>
      </div>

      <nav className="space-y-1 flex-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
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

      <div className="mt-4 px-4 py-4 border border-dark-lighter rounded-lg mb-4">
        <div className="font-headline text-[10px] uppercase tracking-widest text-primary mb-1">Helpful tip</div>
        <p className="text-[12px] text-muted leading-relaxed mb-3">
          Events with a cover image and a clear tagline get{" "}
          <span className="text-primary font-semibold">38% more</span> sign‑ups.
        </p>
        <button className="font-headline text-[11px] uppercase tracking-widest text-light hover:text-primary flex items-center gap-1 transition-colors">
          Learn more <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <Link
        href="/organiser"
        className="flex items-center gap-3 px-4 py-3 rounded-md font-headline text-[13px] font-bold text-muted hover:text-primary hover:bg-dark-light/50 transition-colors"
      >
        <LogOut className="w-5 h-5" /> Sign out
      </Link>
    </aside>
  );
}
