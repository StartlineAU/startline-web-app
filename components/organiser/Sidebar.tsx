"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BarChart2, Ticket, Settings, LogOut,
  CheckCircle, ChevronRight,
} from "lucide-react";

const NAV = [
  { href: "/organiser/dashboard", label: "Event Listings", icon: LayoutDashboard },
  { href: "/organiser/analytics", label: "Analytics",      icon: BarChart2       },
  { href: "/organiser/tickets",   label: "Tickets",        icon: Ticket          },
  { href: "/organiser/settings",  label: "Settings",       icon: Settings        },
];

export default function OrganiserSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-dark-lighter bg-dark p-5">
      {/* Org profile */}
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-dark-lighter">
        <div className="w-10 h-10 rounded-full bg-primary text-dark font-headline font-black italic text-lg flex items-center justify-center flex-shrink-0">
          H
        </div>
        <div className="min-w-0">
          <div className="font-headline text-[13px] font-black italic tracking-tighter text-light truncate">
            HYROX Australia
          </div>
          <div className="flex items-center gap-1 font-headline text-[10px] text-primary uppercase tracking-widest mt-0.5">
            <CheckCircle className="w-3 h-3" /> Verified
          </div>
        </div>
      </div>

      <nav className="space-y-1 flex-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href === "/organiser/dashboard" &&
              (pathname?.startsWith("/organiser/new-listing") ?? false));
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded font-headline text-[13px] font-medium uppercase tracking-tight transition-colors
                ${isActive
                  ? "bg-dark-light text-light nav-active"
                  : "text-muted hover:text-light hover:bg-dark-light/50"
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 px-3 py-4 border border-dark-lighter rounded-lg mb-4">
        <div className="font-headline text-[10px] uppercase tracking-widest text-primary mb-1">
          PRO TIP
        </div>
        <p className="text-[12px] text-muted-light leading-relaxed mb-3">
          Events with a course map get{" "}
          <span className="text-primary font-semibold">38% more</span> saves.
        </p>
        <button className="font-headline text-[11px] uppercase tracking-widest text-light hover:text-primary flex items-center gap-1 transition-colors">
          Learn more <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <Link
        href="/organiser"
        className="flex items-center gap-3 px-3 py-2.5 rounded font-headline text-[13px] font-medium uppercase tracking-tight text-muted hover:text-primary transition-colors"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </Link>
    </aside>
  );
}
