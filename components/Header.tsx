"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X, Search, User, ChevronDown, LogOut, LayoutDashboard, Heart } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const navItems = [
  { href: "/", label: "HOME" },
  { href: "/events", label: "EVENTS" },
  { href: "/about", label: "ABOUT" },
  { href: "/contact", label: "CONTACT" },
];

function UserDropdown() {
  const { user, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-dark-lighter animate-pulse" />
    );
  }

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="font-headline text-[14px] font-bold text-primary border border-primary/30 px-4 py-1.5 rounded hover:bg-primary hover:text-dark-darker transition-all active:scale-95"
      >
        SIGN IN
      </a>
    );
  }

  const role = user["https://www.startlineau.com/role"] as string | undefined;
  const isOrganiser = role === "organiser";
  const initials = ((user.name ?? user.email ?? "U") as string)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 group"
      >
        {user.picture ? (
          <img
            src={user.picture as string}
            alt=""
            className="w-8 h-8 rounded-full object-cover border border-dark-lighter group-hover:border-primary transition-colors"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-dark font-headline text-xs font-bold">
            {initials}
          </div>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-muted group-hover:text-primary transition-all ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-dark border border-dark-lighter rounded-xl shadow-xl animate-fade-in z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-lighter">
            <p className="font-headline text-sm font-bold text-light truncate">{(user.name as string) ?? "User"}</p>
            <p className="font-headline text-[10px] uppercase tracking-widest text-muted truncate">{user.email as string}</p>
          </div>
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary hover:bg-dark-light transition-colors"
            >
              <User className="w-3.5 h-3.5" /> Profile
            </Link>
            <Link
              href="/profile#saved"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary hover:bg-dark-light transition-colors"
            >
              <Heart className="w-3.5 h-3.5" /> Saved Events
            </Link>
            {isOrganiser && (
              <Link
                href="/organiser/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary hover:bg-dark-light transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Organiser Dashboard
              </Link>
            )}
          </div>
          <div className="border-t border-dark-lighter py-1">
            <a
              href="/auth/logout"
              className="flex items-center gap-3 px-4 py-2.5 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-red-400 hover:bg-dark-light transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const role = user
    ? (user["https://www.startlineau.com/role"] as string | undefined)
    : undefined;
  const isOrganiser = role === "organiser";

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
          <UserDropdown />
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
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="font-headline text-sm uppercase tracking-tighter text-muted hover:text-primary py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
                {isOrganiser && (
                  <Link
                    href="/organiser/dashboard"
                    className="font-headline text-sm uppercase tracking-tighter text-muted hover:text-primary py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Organiser Dashboard
                  </Link>
                )}
                <a
                  href="/auth/logout"
                  className="font-headline text-sm font-bold text-red-400 border border-red-400/30 px-4 py-3 text-center hover:bg-red-400 hover:text-dark-darker mt-2 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  SIGN OUT
                </a>
              </>
            ) : (
              <a
                href="/auth/login"
                className="font-headline text-sm font-bold text-primary border border-primary/30 px-4 py-3 text-center hover:bg-primary hover:text-dark-darker mt-2 rounded"
                onClick={() => setIsMenuOpen(false)}
              >
                SIGN IN
              </a>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
