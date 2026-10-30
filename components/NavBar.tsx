"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import SignInModal from "@/components/SignInModal";
import AccountMenu from "@/components/AccountMenu";
import { useAuthContext } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";

type NavItem = { href: string; label: string };

const USER_NAV: NavItem[] = [
  { href: "/", label: "HOME" },
  { href: "/events", label: "EVENTS" },
];

export default function NavBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, role, organiserCount, memberships, status, logout } = useAuthContext();
  const { open: openSettings, profileSavedAt } = useSettings();

  const [isMenuOpen,   setIsMenuOpen]   = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  // Which tab the auth modal opens on. SIGN IN and SIGN UP share one modal.
  const [authView,     setAuthView]     = useState<"signin" | "signup">("signin");
  const [isUserOpen,   setIsUserOpen]   = useState(false);
  const [profileName,  setProfileName]  = useState<string | null>(null);
  const [profilePic,   setProfilePic]   = useState<string | null>(null);

  const userRef = useRef<HTMLDivElement>(null);
  const navRef  = useRef<HTMLDivElement>(null);

  // ?signin=true opens the modal. Keyed on pathname as well as status: the nav
  // never unmounts, so on a client-side navigation (e.g. the organiser-setup
  // gate linking to "/?signin=true") status alone never changes and the param
  // would go unread. The flag is stripped once handled so closing the modal
  // and refreshing doesn't reopen it.
  useEffect(() => {
    // Open while status is still "loading" too — waiting for the session check
    // leaves the user staring at a page that ignored their click. If they turn
    // out to be signed in, the effect below closes it again.
    if (status === "authenticated") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") !== "true") return;
    startTransition(() => {
      setAuthView("signin");
      setIsSignInOpen(true);
    });
    router.replace(pathname ?? "/", { scroll: false });
  }, [status, pathname, router]);

  useEffect(() => {
    if (status === "authenticated") startTransition(() => setIsSignInOpen(false));
  }, [status]);

  // Keyed on the account, not just status: signing out of one account and into
  // another in the same tab, or in another tab, never unmounts the nav. Writing
  // only the fields the reply had left the previous account's name and photo in
  // the header for an account that has none yet, so both are replaced outright.
  const sub = user?.sub ?? null;
  useEffect(() => {
    startTransition(() => {
      setProfileName(null);
      setProfilePic(null);
    });
  }, [sub]);

  useEffect(() => {
    if (status !== "authenticated" || !sub) return;
    let cancelled = false;
    fetch("/api/user/profile")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        startTransition(() => {
          setProfileName(data.name || null);
          setProfilePic(data.profilePicUrl || null);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // profileSavedAt: the settings menu changed the name or photo shown here.
  }, [status, sub, profileSavedAt]);

  useEffect(() => {
    if (!isUserOpen && !isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setIsUserOpen(false);
      if (navRef.current  && !navRef.current.contains(e.target as Node))  setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isUserOpen, isMenuOpen]);

  const handleSignOut = async () => {
    await logout();
    router.push("/");
  };

  const openAuth = (view: "signin" | "signup") => {
    setAuthView(view);
    setIsSignInOpen(true);
  };

  const switchOrganiser = async (organiserId: string) => {
    try {
      await fetch("/api/organiser/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserId }),
      });
    } catch {}
    setIsUserOpen(false);
    router.push("/organiser/dashboard");
  };

  if (pathname?.startsWith("/admin/login")) return null;

  const displayName = profileName ?? user?.email ?? "";
  const initial     = displayName[0]?.toUpperCase() ?? "A";
  const isAdmin      = role === "admin";

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-darker/80 backdrop-blur-xl border-b border-white/[0.05] pt-safe">
        <div className="flex items-center justify-between h-14 max-w-[1200px] mx-auto px-4 sm:px-6 gap-4">

          {/* ── Logo ── */}
          <Link href="/" className="shrink-0 py-1 flex items-center gap-2">
            <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
          </Link>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {USER_NAV.map(({ href, label }) => {
              const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;
              return (
                <Link key={label} href={href}
                  className={`inline-flex items-center min-h-11 px-3 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150
                    ${isActive ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
                >
                  {label}
                </Link>
              );
            })}
            {status === "authenticated" && (
              <Link href="/activity"
                className={`px-3 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150
                  ${pathname?.startsWith("/activity") ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              >
                ACTIVITY
              </Link>
            )}
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Desktop: unauthenticated. SIGN UP is the primary action, so it
                takes the lime face and the machined shadow; SIGN IN stays a
                hairline outline next to it. */}
            {status !== "authenticated" && (
              <>
                <button onClick={() => openAuth("signin")} disabled={status === "loading"}
                  className="hidden md:inline-flex items-center justify-center h-11 px-3 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-white border border-white/30 hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-default">
                  SIGN IN
                </button>
                <button onClick={() => openAuth("signup")} disabled={status === "loading"}
                  className="hidden md:inline-flex items-center justify-center h-11 px-4 rounded-lg bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-30 disabled:cursor-default">
                  SIGN UP
                </button>
              </>
            )}

            {/* Desktop: authenticated user menu */}
            {status === "authenticated" && (
              <div ref={userRef} className="hidden md:block relative">
                <button onClick={() => setIsUserOpen(o => !o)} data-testid="user-menu" aria-label="Account menu"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  {profilePic ? (
                    <Image src={profilePic} alt="" width={28} height={28} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
                      {initial}
                    </span>
                  )}
                  <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-white/70 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isUserOpen ? "rotate-180" : ""}`} />
                </button>

                {isUserOpen && (
                  <div data-testid="user-menu-panel" className="absolute right-0 top-full mt-1 pt-1 min-w-[220px] max-w-[calc(100vw-1.5rem)] bg-dark-darker border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden">
                    <AccountMenu
                      variant="dropdown"
                      organisations={memberships}
                      isAdmin={isAdmin}
                      onNavigate={() => setIsUserOpen(false)}
                      onSelectOrganisation={switchOrganiser}
                      onOpenSettings={openSettings}
                      onSignOut={handleSignOut}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Mobile hamburger */}
            <button onClick={() => { setIsMenuOpen(!isMenuOpen); }}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu" aria-expanded={isMenuOpen}>
              {isMenuOpen ? <X className="w-4 h-4 text-white/70" /> : <Menu className="w-4 h-4 text-white/70" />}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown ── */}
        {isMenuOpen && (
          <div className="md:hidden bg-dark-darker/95 backdrop-blur-xl border-t border-white/[0.05] max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-1.5">
              {USER_NAV.map(({ href, label }) => {
                const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;
                return (
                  <Link key={label} href={href} onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                      ${isActive ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                    {label}
                  </Link>
                );
              })}
              {status === "authenticated" && (
                <Link href="/activity" onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-headline text-[13px] font-bold uppercase tracking-widest transition-colors
                    ${pathname?.startsWith("/activity") ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                  ACTIVITY
                </Link>
              )}

              {/* The same account menu as the desktop dropdown. Home is left
                  out here because it is already the first link above. */}
              {status === "authenticated" ? (
                <>
                  <div className="border-t border-white/10 my-1.5" />
                  <AccountMenu
                    variant="list"
                    showHome={false}
                    organisations={memberships}
                    isAdmin={isAdmin}
                    onNavigate={() => setIsMenuOpen(false)}
                    onSelectOrganisation={switchOrganiser}
                    onOpenSettings={openSettings}
                    onSignOut={handleSignOut}
                  />
                </>
              ) : (
                <div className="border-t border-white/10 mt-1.5 pt-3 pb-2 space-y-2">
                  <button onClick={() => { setIsMenuOpen(false); openAuth("signup"); }} disabled={status === "loading"}
                    className="w-full h-11 rounded-lg bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform disabled:opacity-30">
                    SIGN UP
                  </button>
                  <button onClick={() => { setIsMenuOpen(false); openAuth("signin"); }} disabled={status === "loading"}
                    className="w-full h-11 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-white border border-white/30 hover:border-primary hover:text-primary transition-colors disabled:opacity-30">
                    SIGN IN
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} initialView={authView} />
    </>
  );
}
