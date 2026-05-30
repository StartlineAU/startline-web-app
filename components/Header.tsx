"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

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
                    : "text-muted hover:text-primary hover:-translate-y-0.5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <Button
            disabled
            className="hidden md:inline-flex h-auto px-4 py-1.5 rounded font-headline text-[14px] font-bold tracking-normal normal-case text-muted bg-transparent border border-dark-lighter hover:bg-transparent disabled:opacity-50 cursor-not-allowed"
          >
            SIGN IN
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-auto w-auto p-2 text-light hover:text-primary hover:bg-transparent transition-colors [&_svg]:size-6"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

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
            <Button
              disabled
              className="font-headline text-sm font-bold tracking-normal normal-case text-muted bg-transparent border border-dark-lighter px-4 py-3 h-auto text-center mt-2 rounded hover:bg-transparent disabled:opacity-50 cursor-not-allowed"
            >
              SIGN IN
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
