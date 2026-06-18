"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut, ChevronDown } from "lucide-react";
import SignInModal from "@/components/SignInModal";
import { useAuthContext } from "@/context/AuthContext";

const navItems = [
  { href: "/", label: "HOME" },
  { href: "/events", label: "EVENTS" },
  { href: "/about", label: "ABOUT" },
];

export default function Header() {
  const [isMenuOpen,   setIsMenuOpen]   = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isUserOpen,   setIsUserOpen]   = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const { user, status, logout } = useAuthContext();

  const handleSignOut = async () => {
    setIsUserOpen(false);
    await logout();
    router.push("/");
  };

  const initial = user?.email?.[0]?.toUpperCase() ?? "A";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-light/80 backdrop-blur-md border-b border-dark-lighter">
      <div className="flex justify-between items-center md:grid md:grid-cols-[1fr_auto_1fr] w-full px-4 sm:px-6 h-14 max-w-[1440px] mx-auto">
        {/* Left - logo */}
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

        {/* Centre - desktop nav */}
        <div className="hidden md:flex gap-8 items-center">
          {[...navItems, ...(status === "authenticated" ? [{ href: "/profile", label: "PROFILE" }] : [])].map((item) => {
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

        {/* Right - auth / hamburger */}
        <div className="flex items-center justify-end gap-3">

          {/* Desktop: unauthenticated */}
          {status !== "authenticated" && (
            <button
              onClick={() => setIsSignInOpen(true)}
              disabled={status === "loading"}
              className="hidden md:inline-flex items-center justify-center h-9 px-4 rounded font-headline text-[13px] font-bold tracking-normal normal-case text-muted bg-transparent border border-dark-lighter hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              SIGN IN
            </button>
          )}

          {/* Desktop: authenticated */}
          {status === "authenticated" && (
            <div className="hidden md:block relative">
              <button
                onClick={() => setIsUserOpen((s) => !s)}
                className="flex items-center gap-2 h-9 px-3 rounded border border-dark-lighter hover:border-primary transition-colors group"
              >
                <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center font-headline text-[11px] font-black text-dark">
                  {initial}
                </span>
                <span className="font-headline text-[12px] font-bold text-muted group-hover:text-primary transition-colors max-w-[120px] truncate">
                  {user?.email}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${isUserOpen ? "rotate-180" : ""}`} />
              </button>

              {isUserOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsUserOpen(false)} />
                  <div className="absolute right-0 top-11 z-20 w-44 bg-dark border border-dark-lighter rounded-xl shadow-xl overflow-hidden animate-fade-in">
                    <button onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[12px] uppercase tracking-widest text-muted hover:text-red-400 hover:bg-dark-lighter transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Hamburger - mobile only */}
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
            {[...navItems, ...(status === "authenticated" ? [{ href: "/profile", label: "PROFILE" }] : [])].map((item) => {
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
              {status === "authenticated" ? (
                <button onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                  className="flex items-center gap-3 w-full h-12 px-4 font-headline text-sm font-bold tracking-normal normal-case text-muted border border-dark-lighter rounded hover:border-red-400 hover:text-red-400 transition-colors">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              ) : (
                <button
                  onClick={() => { setIsMenuOpen(false); setIsSignInOpen(true); }}
                  disabled={status === "loading"}
                  className="w-full flex items-center justify-center h-12 font-headline text-sm font-bold tracking-normal normal-case text-muted bg-transparent border border-dark-lighter rounded hover:border-primary hover:text-primary transition-colors disabled:opacity-30"
                >
                  SIGN IN
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </nav>
  );
}
