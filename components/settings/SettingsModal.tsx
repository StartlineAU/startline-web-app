"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Bell, BellRing, Building2, ChevronLeft, ChevronRight, Cookie, CreditCard, IdCard, Lock, User, Users, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/AuthContext";
import {
  isOrganisationSection, isSettingsSection, useSettings, type SettingsSection,
} from "@/context/SettingsContext";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionShell, Switch } from "@/components/settings/primitives";
import AthleteProfileSection from "@/components/settings/AthleteProfileSection";
import PersonalDetailsSection from "@/components/settings/PersonalDetailsSection";
import SecuritySection from "@/components/settings/SecuritySection";
import OrganisationSection from "@/components/settings/OrganisationSection";
import OrganisationNotificationsSection from "@/components/settings/OrganisationNotificationsSection";
import AthleteNotificationsSection from "@/components/settings/AthleteNotificationsSection";
import { MembersSection, PaymentsSection } from "@/components/settings/OrganisationLinkSections";

type Item = { id: SettingsSection; label: string; icon: LucideIcon };

const ACCOUNT_ITEMS: Item[] = [
  { id: "profile",  label: "Profile",          icon: User   },
  { id: "details",  label: "Personal details", icon: IdCard },
  { id: "alerts",   label: "My notifications", icon: BellRing },
  { id: "security", label: "Login & security", icon: Lock   },
];

// Cookies are set by the site whichever portal you are in, so they sit apart
// from both the athlete account and the organisation.
const PRIVACY_ITEMS: Item[] = [
  { id: "cookies", label: "Cookies", icon: Cookie },
];

const ORGANISATION_ITEMS: Item[] = [
  { id: "organisation",  label: "Organisation profile", icon: Building2  },
  { id: "members",       label: "Members",              icon: Users      },
  { id: "notifications", label: "Notifications",        icon: Bell       },
  { id: "payments",      label: "Payments",             icon: CreditCard },
];

type Membership = { organiserId: string; organiserName: string | null; role: string; logoUrl: string | null };
type Organisations = { memberships: Membership[]; activeId: string | null };

const groupLabelCls = "px-4 pt-4 pb-1.5 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark";

// ── Small sections ──────────────────────────────────────────────────────────

function CookiesSection() {
  const { close } = useSettings();
  return (
    <SectionShell
      title="Cookies"
      description="Startline uses essential cookies to keep you signed in. No advertising, analytics or tracking cookies are used, so there is nothing else to switch on or off."
    >
      <div className="flex items-center justify-between gap-4 py-3">
        <div>
          <div id="cookies-essential-label" className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted-light">Essential cookies</div>
          <div className="text-[11px] text-muted-dark mt-0.5">Required for the platform to function. Always on.</div>
        </div>
        {/* Locked on: without these there is no sign-in to speak of. */}
        <Switch checked onChange={() => {}} disabled labelledBy="cookies-essential-label" />
      </div>
      <Link href="/cookies" onClick={close}
        className="inline-flex items-center gap-1.5 mt-6 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors">
        Read the cookie policy <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </SectionShell>
  );
}

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "profile":       return <AthleteProfileSection />;
    case "details":       return <PersonalDetailsSection />;
    case "alerts":        return <AthleteNotificationsSection />;
    case "members":       return <MembersSection />;
    case "security":      return <SecuritySection />;
    case "cookies":       return <CookiesSection />;
    case "organisation":  return <OrganisationSection />;
    case "notifications": return <OrganisationNotificationsSection />;
    case "payments":      return <PaymentsSection />;
  }
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return role === "OWNER"
    ? <span className="shrink-0 font-headline text-[9px] uppercase tracking-widest text-primary border border-primary/40 rounded px-1.5 py-0.5">Owner</span>
    : <span className="shrink-0 font-headline text-[9px] uppercase tracking-widest text-white/40 border border-white/15 rounded px-1.5 py-0.5">Manager</span>;
}

function NavItems({ items, active }: { items: Item[]; active: SettingsSection }) {
  const { setSection } = useSettings();
  return (
    <>
      {items.map(({ id, label, icon: Icon }) => {
        const current = active === id;
        return (
          <button key={id} type="button" onClick={() => setSection(id)} aria-current={current ? "page" : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left transition-colors border-r-2 border-r-transparent text-muted hover:text-light hover:bg-white/5",
              // On a phone the list is its own screen, so nothing in it is highlighted.
              current && "sm:bg-dark-light sm:text-white sm:border-r-primary",
            )}>
            <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden />
            <span className="flex-1 font-headline text-[12px] sm:text-[11px] font-bold uppercase tracking-widest">{label}</span>
            <ChevronRight className="w-4 h-4 text-muted-dark sm:hidden" aria-hidden />
          </button>
        );
      })}
    </>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

export default function SettingsModal({ portal }: { portal: "athlete" | "organiser" }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuthContext();
  const { isOpen, section, menuOpen, open, close, showMenu } = useSettings();

  // null while loading. An athlete with no organisation gets an empty list,
  // and with it no organisation group at all.
  const [orgs,      setOrgs]      = useState<Organisations | null>(null);
  const [switching, setSwitching] = useState(false);

  // ?settings=<section> opens the menu on that section. /settings/security
  // redirects here, and an organisation switch uses it to come back after the
  // reload. The flag is stripped once read so a refresh does not reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("settings");
    if (requested === null) return;
    if (isSettingsSection(requested)) startTransition(() => open(requested));
    params.delete("settings");
    const rest = params.toString();
    router.replace(`${pathname ?? "/"}${rest ? `?${rest}` : ""}`, { scroll: false });
  }, [pathname, router, open]);

  const loadOrgs = useCallback(async () => {
    try {
      const r = await fetch("/api/organiser/memberships");
      const data = r.ok ? await r.json() : null;
      setOrgs({ memberships: data?.memberships ?? [], activeId: data?.activeOrganiserId ?? null });
    } catch {
      setOrgs({ memberships: [], activeId: null });
    }
  }, []);

  const shown = isOpen && status === "authenticated";

  useEffect(() => {
    if (shown) startTransition(() => { loadOrgs(); });
  }, [shown, loadOrgs]);

  const switchOrganisation = async (organiserId: string) => {
    setSwitching(true);
    try {
      await fetch("/api/organiser/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserId }),
      });
    } catch {}
    if (portal === "organiser") {
      // Every organiser page under the modal is showing the old organisation,
      // so reload it, and come back to this section.
      // A full load on purpose: a client-side navigation would keep the pages'
      // already-fetched data for the previous organisation.
      const url = new URL(window.location.href);
      url.searchParams.set("settings", section);
      window.location.replace(url.toString());
      return;
    }
    await loadOrgs();
    setSwitching(false);
  };

  if (!shown) return null;

  const activeOrg = orgs?.memberships.find(m => m.organiserId === orgs.activeId) ?? orgs?.memberships[0] ?? null;
  const orgsLoading = orgs === null;
  // Someone with no organisation who lands on an organisation section, say
  // from a stale link, gets their own profile instead of an empty pane.
  const active: SettingsSection = isOrganisationSection(section) && !orgsLoading && !activeOrg ? "profile" : section;

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogPortal>
        <DialogOverlay className="z-80 flex items-stretch sm:items-center justify-center sm:p-4">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            // Focus the dialog itself. The default lands on the first button,
            // which drew a focus ring on Close every time the menu opened.
            onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}
            className="relative w-full sm:max-w-220 h-full sm:h-[min(88vh,720px)] bg-dark sm:border sm:border-dark-lighter sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden focus-visible:outline-none! pt-safe"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between gap-3 h-14 px-3 sm:px-5 border-b border-dark-lighter">
              <div className="flex items-center min-w-0">
                {!menuOpen && (
                  <button type="button" onClick={showMenu} aria-label="All settings"
                    className="sm:hidden flex items-center justify-center w-9 h-9 -ml-1 mr-1 rounded-lg text-muted hover:text-light hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <DialogPrimitive.Title className="pl-1 sm:pl-0 font-headline text-sm font-bold uppercase tracking-widest text-primary">
                  Settings
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close aria-label="Close settings"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:text-light hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="flex-1 min-h-0 flex">
              {/* Section list */}
              <nav aria-label="Settings sections"
                className={cn(
                  "w-full sm:w-60 shrink-0 sm:border-r border-dark-lighter bg-dark-darker overflow-y-auto scroll-slim pb-4 sm:block",
                  menuOpen ? "block" : "hidden",
                )}>
                <div className={groupLabelCls}>My account</div>
                {user?.email && (
                  <div className="px-4 pb-2 text-[12px] text-muted truncate" title={user.email}>{user.email}</div>
                )}
                <NavItems items={ACCOUNT_ITEMS} active={active} />

                {orgsLoading && (
                  <div className="px-4 pt-5 space-y-2" role="status" aria-label="Loading organisation">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                )}

                {activeOrg && orgs && (
                  <>
                    <div className="border-t border-dark-lighter mt-3" />
                    <div className={groupLabelCls}>Organisation</div>
                    <div className="px-4 pb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {activeOrg.logoUrl
                          ? <Image src={activeOrg.logoUrl} alt="" width={24} height={24} className="w-6 h-6 rounded object-cover shrink-0" />
                          : <span className="w-6 h-6 rounded bg-primary text-dark font-headline font-black italic text-[11px] flex items-center justify-center shrink-0">
                              {(activeOrg.organiserName ?? "O").charAt(0).toUpperCase()}
                            </span>}
                        <span className="flex-1 min-w-0 truncate text-[12px] text-light">{activeOrg.organiserName ?? "Organisation"}</span>
                        <RoleBadge role={activeOrg.role} />
                      </div>
                      {orgs.memberships.length > 1 && (
                        <select aria-label="Switch organisation" value={activeOrg.organiserId} disabled={switching}
                          onChange={(e) => switchOrganisation(e.target.value)}
                          className="mt-2.5 w-full bg-dark-light border border-dark-lighter rounded-lg px-2.5 py-2 text-[12px] text-light focus:border-primary focus:outline-none transition-colors disabled:opacity-50">
                          {orgs.memberships.map(m => (
                            <option key={m.organiserId} value={m.organiserId}>{m.organiserName ?? "Organisation"}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <NavItems items={ORGANISATION_ITEMS} active={active} />
                  </>
                )}

                {!orgsLoading && (
                  <>
                    <div className="border-t border-dark-lighter mt-3" />
                    <div className={groupLabelCls}>Privacy</div>
                    <NavItems items={PRIVACY_ITEMS} active={active} />
                  </>
                )}
              </nav>

              {/* Section */}
              <div className={cn("flex-1 min-w-0 flex-col sm:flex", menuOpen ? "hidden" : "flex")}>
                {isOrganisationSection(active) && orgsLoading ? (
                  <div className="px-5 sm:px-6 py-5 space-y-5" role="status" aria-label="Loading settings">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-28 w-full rounded-xl" />
                    <Skeleton className="h-11 w-full rounded-lg" />
                  </div>
                ) : (
                  // Keyed on the organisation so a switch reloads its sections.
                  <SectionContent key={`${active}:${isOrganisationSection(active) ? activeOrg?.organiserId : ""}`} section={active} />
                )}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogOverlay>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
