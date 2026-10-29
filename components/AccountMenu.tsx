"use client";

import Image from "next/image";
import Link from "next/link";
import { Building2, House, LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { customerHref } from "@/lib/portal-domains";
import { usePortalHost } from "@/lib/use-portal-host";

export type AccountMenuOrganisation = {
  organiserId:   string;
  organiserName: string | null;
  logoUrl:       string | null;
};

type Props = {
  /** "dropdown" hangs off the avatar on desktop; "list" sits in the phone menu. */
  variant: "dropdown" | "list";
  organisations: AccountMenuOrganisation[];
  isAdmin?: boolean;
  /** The athlete phone menu already opens with a Home link, so it leaves this one out. */
  showHome?: boolean;
  /** Called by every row, so the caller can close whichever menu this sits in. */
  onNavigate: () => void;
  onSelectOrganisation: (organiserId: string) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
};

/**
 * The account menu, the same on the athlete site and in the organiser portal:
 * Home, the athlete account, the organiser account, Settings, Sign Out. The
 * two navbars each used to build their own, and they had drifted apart in
 * what they listed and in what order.
 */
export default function AccountMenu({
  variant, organisations, isAdmin = false, showHome = true,
  onNavigate, onSelectOrganisation, onOpenSettings, onSignOut,
}: Props) {
  // Home and the athlete profile live on the athlete site. A bare path is
  // wrong on the organiser host in production (see lib/portal-domains.ts).
  const host = usePortalHost();
  const list = variant === "list";

  const row = `w-full flex items-center gap-3 px-4 py-3 text-left font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors ${list ? "rounded-lg" : ""}`;
  const heading = `px-4 pt-2 pb-1 font-headline text-[10px] font-bold uppercase tracking-widest ${list ? "text-white/30" : "text-white/40"}`;
  const divider = <div className={`border-t border-white/10 ${list ? "my-1.5" : "my-1"}`} />;

  return (
    <>
      {showHome && (
        <>
          <Link href={customerHref("/", host)} onClick={onNavigate} className={row}>
            <House className="w-4 h-4 shrink-0" /> Home
          </Link>
          {divider}
        </>
      )}

      <div className={heading}>My athlete account</div>
      <Link href={customerHref("/profile", host)} onClick={onNavigate} className={row}>
        <User className="w-4 h-4 shrink-0" /> Athlete profile
      </Link>

      {organisations.length > 0 && (
        <>
          {divider}
          <div className={heading}>My organiser account</div>
          {organisations.map((m) => (
            <button key={m.organiserId} type="button" className={row}
              onClick={() => { onNavigate(); onSelectOrganisation(m.organiserId); }}>
              {m.logoUrl
                ? <Image src={m.logoUrl} alt="" width={16} height={16} className="w-4 h-4 rounded object-cover shrink-0" />
                : <Building2 className="w-4 h-4 shrink-0" />}
              <span className="min-w-0 truncate">{m.organiserName ?? "Organisation"}</span>
            </button>
          ))}
        </>
      )}

      {isAdmin && (
        <>
          {divider}
          <div className={heading}>Admin</div>
          <Link href="/admin/dashboard" onClick={onNavigate} className={row}>
            <ShieldCheck className="w-4 h-4 shrink-0" /> Dashboard
          </Link>
        </>
      )}

      {divider}
      <button type="button" className={row} onClick={() => { onNavigate(); onOpenSettings(); }}>
        <Settings className="w-4 h-4 shrink-0" /> Settings
      </button>

      {list ? (
        <div className="border-t border-white/10 mt-1.5 pt-3 pb-2">
          <button type="button" onClick={() => { onNavigate(); onSignOut(); }}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg font-headline text-[12px] font-bold uppercase tracking-widest text-red-400/80 border border-white/10 hover:text-red-400 hover:border-red-400/30 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      ) : (
        <>
          <div className="border-t border-white/10 mt-1" />
          <button type="button" onClick={onSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </>
      )}
    </>
  );
}
