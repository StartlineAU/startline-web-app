"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";

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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-light border-b border-dark-lighter">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-[1440px] mx-auto">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo-title.svg"
            alt="StartLine"
            width={160}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-8 items-center">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`font-headline text-[14px] uppercase tracking-tighter font-medium transition-all duration-100 ${
                  isActive
                    ? "text-primary border-b-2 border-primary pb-1"
                    : "text-muted hover:text-primary hover:-translate-y-0.5 hover:-translate-x-0.5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <button
            className="text-muted hover:text-primary transition-colors p-2"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          <Link
            href="/profile"
            className="hidden md:inline font-headline text-[14px] font-bold text-muted border border-dark-lighter px-4 py-1.5 rounded hover:border-primary hover:text-primary transition-all"
          >
            MY LISTS
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-light hover:text-primary transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-dark-lighter py-4 px-6 animate-fade-in">
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="font-headline text-sm uppercase tracking-tighter text-muted hover:text-primary py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/profile"
              className="font-headline text-sm font-bold text-primary border border-primary/30 px-4 py-3 text-center hover:bg-primary hover:text-dark-darker mt-2 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              MY LISTS
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
