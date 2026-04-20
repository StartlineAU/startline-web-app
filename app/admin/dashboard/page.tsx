"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Users, Calendar, Clock, CheckCircle, XCircle, LogOut, ShieldCheck } from "lucide-react";

interface Stats {
  pendingOrganisers: number;
  approvedOrganisers: number;
  pendingEvents: number;
  approvedEvents: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/organisers?status=PENDING_REVIEW").then((r) => r.json()),
      fetch("/api/admin/organisers?status=APPROVED").then((r) => r.json()),
      fetch("/api/admin/events?status=PENDING").then((r) => r.json()),
      fetch("/api/admin/events?status=APPROVED").then((r) => r.json()),
    ]).then(([pendingOrgs, approvedOrgs, pendingEvts, approvedEvts]) => {
      setStats({
        pendingOrganisers:  Array.isArray(pendingOrgs)  ? pendingOrgs.length  : 0,
        approvedOrganisers: Array.isArray(approvedOrgs) ? approvedOrgs.length : 0,
        pendingEvents:      Array.isArray(pendingEvts)  ? pendingEvts.length  : 0,
        approvedEvents:     Array.isArray(approvedEvts) ? approvedEvts.length : 0,
      });
    }).finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin");
  };

  return (
    <div className="min-h-screen bg-dark-darker">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-16 bg-dark border-b border-dark-lighter flex items-center px-6">
        <Image src="/images/logo-title.svg" alt="Startline" width={130} height={34} className="h-8 w-auto" />
        <div className="ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-lighter">
          <ShieldCheck className="w-3 h-3 text-primary" />
          <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary">Admin</span>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <Link href="/admin/organisers" className="font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary transition-colors flex items-center gap-1.5"><Users className="w-4 h-4" /> Organisers</Link>
          <Link href="/admin/events"     className="font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary transition-colors flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Events</Link>
          <button onClick={handleLogout} className="font-headline text-[12px] uppercase tracking-widest text-muted hover:text-primary transition-colors flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
      </div>

      <div className="pt-16 p-8 lg:p-12">
        <div className="max-w-[1100px] mx-auto">
          <div className="mb-10">
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-3 flex items-center gap-3">
              <span className="w-8 h-px bg-primary" /> Overview
            </div>
            <h1 className="font-headline text-5xl font-black italic tracking-tighter text-light">
              Admin<br /><span className="text-primary">dashboard.</span>
            </h1>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Pending applications", value: stats?.pendingOrganisers  ?? "—", icon: Clock,         href: "/admin/organisers",         accent: stats?.pendingOrganisers ? "text-primary" : "" },
              { label: "Approved organisers",  value: stats?.approvedOrganisers ?? "—", icon: CheckCircle,   href: "/admin/organisers?s=APPROVED" },
              { label: "Pending events",        value: stats?.pendingEvents      ?? "—", icon: Calendar,      href: "/admin/events",              accent: stats?.pendingEvents ? "text-primary" : "" },
              { label: "Live events",           value: stats?.approvedEvents     ?? "—", icon: CheckCircle,   href: "/admin/events?s=APPROVED" },
            ].map(({ label, value, icon: Icon, href, accent }) => (
              <Link key={label} href={href} className="bg-dark border border-dark-lighter rounded-lg p-5 hover:border-primary/50 transition-colors group">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-headline text-[10px] uppercase tracking-widest text-muted">{label}</div>
                  <Icon className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                </div>
                <div className={`font-headline text-4xl font-black italic tracking-tighter ${accent || "text-light"}`}>{loading ? "…" : value}</div>
              </Link>
            ))}
          </div>

          {/* Quick links */}
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/admin/organisers"
              className="bg-dark border border-dark-lighter hover:border-primary/50 rounded-lg p-6 transition-colors group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-headline text-[15px] font-black italic tracking-tighter text-light">Review organisers</div>
                  <div className="font-headline text-[10px] uppercase tracking-widest text-muted">Approve or reject applications</div>
                </div>
              </div>
              {!loading && (stats?.pendingOrganisers ?? 0) > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
                  <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary">{stats!.pendingOrganisers} pending</span>
                </div>
              )}
            </Link>

            <Link href="/admin/events"
              className="bg-dark border border-dark-lighter hover:border-primary/50 rounded-lg p-6 transition-colors group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-headline text-[15px] font-black italic tracking-tighter text-light">Review events</div>
                  <div className="font-headline text-[10px] uppercase tracking-widest text-muted">Approve or reject event listings</div>
                </div>
              </div>
              {!loading && (stats?.pendingEvents ?? 0) > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
                  <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary">{stats!.pendingEvents} pending</span>
                </div>
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
