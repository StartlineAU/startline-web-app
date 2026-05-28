"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, User, Plus, CreditCard } from "lucide-react";

const NAV = [
  { href: "/organiser/dashboard", label: "Home",     icon: LayoutDashboard },
  { href: "/organiser/listings",  label: "Listings", icon: CalendarDays    },
  null, // placeholder for the FAB
  { href: "/organiser/payments",  label: "Payments", icon: CreditCard      },
  { href: "/organiser/profile",   label: "Profile",  icon: User            },
];

export default function OrganiserMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark border-t border-dark-lighter"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16">
        {NAV.map((item, i) => {
          // ── FAB (new listing) ──
          if (item === null) {
            return (
              <div key="fab" className="flex-1 flex items-center justify-center">
                <Link
                  href="/organiser/new-listing"
                  aria-label="Create new listing"
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg
                    transition-transform active:scale-95
                    ${pathname?.startsWith("/organiser/new-listing")
                      ? "bg-primary/80 ring-2 ring-primary/40"
                      : "bg-primary"
                    }`}
                >
                  <Plus className="w-6 h-6 text-dark" strokeWidth={2.5} />
                </Link>
              </div>
            );
          }

          const { href, label, icon: Icon } = item;
          const isActive =
            href === "/organiser/listings"
              ? pathname === href || (pathname?.startsWith(href + "/") ?? false)
              : pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors
                ${isActive ? "text-primary" : "text-muted"}`}
            >
              <Icon className="w-[22px] h-[22px]" />
              <span className="font-headline text-[9px] uppercase tracking-widest font-bold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
