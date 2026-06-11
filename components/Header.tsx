"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { href: "/", label: "HOME" },
  { href: "/events", label: "EVENTS" },
  { href: "/about", label: "ABOUT" },
  { href: "/contact", label: "CONTACT" },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-light/80 backdrop-blur-md border-b border-dark-lighter">
      <div className="flex justify-between items-center w-full px-4 sm:px-6 h-14 max-w-[1440px] mx-auto">
        <Link href="/" className="flex items-center py-1" onClick={() => setIsMenuOpen(false)}>
          <Image
            src="/images/logo-title.svg"
            alt="StartLine"
            width={140}
            height={36}
            className="h-7 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex gap-8 items-center">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`font-headline text-[13px] uppercase tracking-tighter font-medium transition-all duration-100 ${
                  isActive
                    ? "text-primary border-b-2 border-primary pb-1"
                    : "text-muted hover:text-primary hover:-translate-y-0.5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Sign in — desktop only */}
          <button
            disabled
            className="hidden md:inline-flex h-9 px-4 rounded font-headline text-[13px] font-bold tracking-normal normal-case text-muted bg-transparent border border-dark-lighter opacity-50 cursor-not-allowed"
          >
            SIGN IN
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex items-center justify-center w-11 h-11 text-light hover:text-primary transition-colors -mr-1.5"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-dark-lighter animate-fade-in">
          <div className="flex flex-col">
            {navItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center px-5 h-[52px] font-headline text-sm uppercase tracking-tighter font-medium border-l-2 transition-colors ${
                    isActive
                      ? "text-primary border-primary bg-primary/5"
                      : "text-muted border-transparent hover:text-primary hover:border-primary/40"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="px-4 py-3 border-t border-dark-lighter">
              <button
                disabled
                className="w-full flex items-center justify-center h-12 font-headline text-sm font-bold tracking-normal normal-case text-muted bg-transparent border border-dark-lighter rounded opacity-50 cursor-not-allowed"
              >
                SIGN IN
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
