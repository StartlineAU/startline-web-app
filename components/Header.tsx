"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, LogOut, User, Building2 } from "lucide-react";
import SignInModal from "@/components/SignInModal";
import { useAuthContext } from "@/context/AuthContext";

const navItems = [
  { href: "/", label: "HOME" },
  { href: "/events", label: "EVENTS" },
  { href: "/activity", label: "ACTIVITY" },
];

export default function Header() {
  const [isMenuOpen,   setIsMenuOpen]   = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isUserOpen,   setIsUserOpen]   = useState(false);
  const [hasOrganiser, setHasOrganiser] = useState(false);
  const [profileName,  setProfileName]  = useState<string | null>(null);
  const profileFetched = useRef(false);
  const pathname = usePathname();
  const router   = useRouter();
  const { user, status, logout } = useAuthContext();

  useEffect(() => {
    if (status !== "authenticated") {
      profileFetched.current = false;
      /* eslint-disable react-hooks/set-state-in-effect */
      setProfileName(null);
      setHasOrganiser(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    if (profileFetched.current) return;
    profileFetched.current = true;
    fetch("/api/user/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProfileName(data.name ?? null);
          setHasOrganiser(!!data.organiser);
        }
      })
      .catch(() => {});
  }, [status]);

  const handleSignOut = async () => {
    setIsUserOpen(false);
    await logout();
    router.push("/");
  };

  const displayName = profileName ?? user?.email ?? "";
  const initial = displayName[0]?.toUpperCase() ?? "A";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-dark-darker/95 border-b border-white/[0.05]">
      <div className="flex items-center justify-between h-full max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="shrink-0 py-1">
          <Image src="/images/logo-title.svg" alt="StartLine" width={110} height={28} className="h-6 w-auto" priority />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-0.5">
          {[...navItems, ...(status === "authenticated" ? [{ href: "/profile", label: "PROFILE" }] : [])].map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`px-3 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150 ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Desktop: unauthenticated */}
          {status !== "authenticated" && (
            <button
              onClick={() => setIsSignInOpen(true)}
              disabled={status === "loading"}
              className="hidden md:inline-flex items-center justify-center h-8 px-3 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-white/60 border border-white/10 hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              SIGN IN
            </button>
          )}

          {/* Desktop: authenticated */}
          {status === "authenticated" && (
            <div className="hidden md:block relative">
              <button
                onClick={() => setIsUserOpen((s) => !s)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
                  {initial}
                </span>
                <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 max-w-[120px] truncate">
                  {displayName}
                </span>
                <svg className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isUserOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-dark-darker/95 backdrop-blur-xl border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                  <Link href="/profile" onClick={() => setIsUserOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <User className="w-4 h-4" /> Profile
                  </Link>

                  {hasOrganiser && (
                    <Link href="/organiser/dashboard" onClick={() => setIsUserOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                      <Building2 className="w-4 h-4" /> Organiser Dashboard
                    </Link>
                  )}

                  <div className="border-t border-white/10" />

                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="w-4 h-4 text-white/70" /> : <Menu className="w-4 h-4 text-white/70" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div className="md:hidden bg-dark-darker/95 backdrop-blur-xl border-t border-white/[0.05] animate-fade-in">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-1.5">
            {[...navItems, ...(status === "authenticated" ? [{ href: "/profile", label: "PROFILE" }] : [])].map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {status === "authenticated" && (
              <>
                <div className="border-t border-white/10 my-1.5" />
                {hasOrganiser && (
                  <Link href="/organiser/dashboard" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <Building2 className="w-4 h-4" /> Organiser Dashboard
                  </Link>
                )}
              </>
            )}

            <div className="border-t border-white/10 mt-1.5 pt-3 pb-2">
              {status === "authenticated" ? (
                <button onClick={() => { setIsMenuOpen(false); handleSignOut(); }}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-red-400/80 border border-white/10 hover:text-red-400 hover:border-red-400/30 transition-colors">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              ) : (
                <button
                  onClick={() => { setIsMenuOpen(false); setIsSignInOpen(true); }}
                  disabled={status === "loading"}
                  className="w-full h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-white/60 border border-white/10 hover:border-primary hover:text-primary transition-colors disabled:opacity-30"
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
