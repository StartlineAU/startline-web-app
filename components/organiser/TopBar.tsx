"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, LogOut, Plus, Settings, Bell, CheckCircle2, XCircle, Menu, X, LayoutDashboard, CalendarDays, CreditCard, BookOpen, ArrowLeft } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

const NAV = [
  { href: "/organiser/dashboard",    label: "Dashboard" },
  { href: "/organiser/listings",     label: "Listings"  },
  { href: "/organiser/profile",      label: "Profile"   },
  { href: "/organiser/payments",     label: "Payments"  },
  { href: "/organiser/how-it-works", label: "Guide"     },
];

interface Notification {
  id: string;
  type: "EVENT_APPROVED" | "EVENT_REJECTED" | "NEW_REGISTRATION";
  title: string;
  body: string;
  eventId: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const NOTIF_ICON: Record<Notification["type"], React.ReactNode> = {
  EVENT_APPROVED:    <CheckCircle2 className="w-4 h-4 text-lime-400" />,
  EVENT_REJECTED:    <XCircle      className="w-4 h-4 text-red-400"  />,
  NEW_REGISTRATION:  <User         className="w-4 h-4 text-blue-400" />,
};

export default function OrganiserTopBar() {
  const router   = useRouter();
  const pathname = usePathname();

  const [orgName,  setOrgName]  = useState("");
  const [initial,  setInitial]  = useState("O");
  const [loaded,   setLoaded]   = useState(false);
  const [open,     setOpen]     = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Notifications
  const [notifOpen,      setNotifOpen]      = useState(false);
  const [notifications,  setNotifications]  = useState<Notification[]>([]);
  const [unreadCount,    setUnreadCount]     = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const { open: openSettingsModal } = useSettings();

  // ── Profile fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/organiser/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const name = data.orgName || data.contactName || data.email || "";
        setOrgName(name);
        if (name) setInitial(name.charAt(0).toUpperCase());
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // ── Notification fetch (poll every 30s) ──────────────────────────────────────
  const fetchNotifications = useCallback(() => {
    fetch("/api/organiser/notifications")
      .then(r => r.ok ? r.json() : null)
      .then((data: { notifications: Notification[]; unreadCount: number } | null) => {
        if (!data) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ── Close dropdowns on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!open && !notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current  && !menuRef.current.contains(e.target as Node))  setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, notifOpen]);

  const openNotifPanel = () => {
    setNotifOpen(o => !o);
    setOpen(false);
    if (unreadCount > 0) {
      fetch("/api/organiser/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
        .then(() => {
          setUnreadCount(0);
          setNotifications(ns => ns.map(n => ({ ...n, read: true })));
        })
        .catch(() => {});
    }
  };

  const handleLogout = async () => {
    setOpen(false);
    const { signOut } = await import("aws-amplify/auth");
    await signOut();
    router.push("/organiser");
  };

  const openSettings = () => {
    setOpen(false);
    openSettingsModal("personal");
  };

  const displayName = loaded
    ? (orgName.length > 18 ? orgName.slice(0, 18) + "…" : orgName) || null
    : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center pointer-events-none">
        <div className="max-w-[1200px] w-full mx-auto px-6">

          {/* Single pill */}
          <div className="pointer-events-auto bg-[#0f0f0f] rounded-xl shadow-lg h-12 flex items-center px-2 relative">

            {/* Logo — left */}
            <Link href="/organiser/dashboard" className="shrink-0 px-3 py-2">
              <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
            </Link>

            {/* Nav links — absolute centre */}
            <div className="hidden lg:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
              {NAV.map(({ href, label }) => {
                const isActive = pathname === href || (pathname?.startsWith(href + "/") ?? false);
                return (
                  <Link key={href} href={href}
                    className={`px-3 py-2 rounded-md font-headline text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-150
                      ${isActive
                        ? "bg-white/15 text-white"
                        : "text-white/50 hover:text-white hover:bg-white/10"
                      }`}>
                    {label}
                  </Link>
                );
              })}
            </div>

            {/* Right side — bell + actions */}
            <div className="ml-auto flex items-center gap-1 shrink-0">

              {/* ── Notification bell ── */}
              <div ref={notifRef} className="relative">
                <button
                  onClick={openNotifPanel}
                  className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 text-white/60" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] bg-primary text-dark font-headline font-black text-[9px] rounded-full flex items-center justify-center px-0.5 leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-[#0f0f0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <div className="font-headline text-[12px] font-bold uppercase tracking-widest text-white/60">Notifications</div>
                      {notifications.length > 0 && (
                        <button
                          onClick={() => fetchNotifications()}
                          className="font-headline text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
                        >
                          Refresh
                        </button>
                      )}
                    </div>
                    <div className="max-h-[380px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell className="w-6 h-6 text-white/20 mx-auto mb-2" />
                          <div className="font-headline text-[12px] uppercase tracking-widest text-white/30">No notifications yet</div>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${!n.read ? "bg-white/5" : ""}`}
                          >
                            <div className="mt-0.5 shrink-0">{NOTIF_ICON[n.type]}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-headline text-[12px] font-bold text-white leading-snug">{n.title}</div>
                                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />}
                              </div>
                              <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="font-headline text-[10px] uppercase tracking-widest text-white/30">{timeAgo(n.createdAt)}</span>
                                {n.eventId && (
                                  <Link
                                    href={`/organiser/events/${n.eventId}/dashboard`}
                                    onClick={() => setNotifOpen(false)}
                                    className="font-headline text-[10px] uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
                                  >
                                    View event →
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Mobile: hamburger menu ── */}
              <div ref={menuRef} className="relative lg:hidden">
                <button
                  onClick={() => { setOpen(o => !o); setNotifOpen(false); }}
                  aria-label="Menu"
                  className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {open ? <X className="w-4 h-4 text-white/70" /> : <Menu className="w-4 h-4 text-white/70" />}
                </button>

                {open && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-64 bg-[#0f0f0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    {/* Account name */}
                    {displayName && (
                      <div className="px-4 py-3 border-b border-white/10">
                        <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Account</div>
                        <div className="font-headline text-[13px] font-bold text-white truncate">{orgName}</div>
                      </div>
                    )}

                    {/* Nav links */}
                    <div className="py-1.5">
                      {[
                        { href: "/organiser/dashboard",    label: "Dashboard",  Icon: LayoutDashboard },
                        { href: "/organiser/listings",     label: "Listings",   Icon: CalendarDays    },
                        { href: "/organiser/profile",      label: "Profile",    Icon: User            },
                        { href: "/organiser/payments",     label: "Payments",   Icon: CreditCard      },
                        { href: "/organiser/how-it-works", label: "Guide",      Icon: BookOpen        },
                        { href: "/organiser/new-listing",  label: "Post an event", Icon: Plus         },
                      ].map(({ href, label, Icon }) => (
                        <Link key={href} href={href} onClick={() => setOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                          <Icon className="w-4 h-4 shrink-0" /> {label}
                        </Link>
                      ))}
                    </div>

                    {/* Settings + Switch + Sign out */}
                    <div className="border-t border-white/10 py-1.5">
                      <button onClick={openSettings}
                        className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                        <Settings className="w-4 h-4 shrink-0" /> Settings
                      </button>
                      <Link href="/"
                        className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-primary/80 hover:text-primary hover:bg-white/5 transition-colors">
                        <ArrowLeft className="w-4 h-4 shrink-0" /> Switch to Customer
                      </Link>
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors">
                        <LogOut className="w-4 h-4 shrink-0" /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Desktop: user avatar dropdown ── */}
              <div ref={menuRef} className="relative hidden lg:block">
                <button
                  onClick={() => { setOpen(o => !o); setNotifOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary text-dark font-headline font-black italic text-sm flex items-center justify-center shrink-0">
                    {initial}
                  </div>
                  {displayName && (
                    <span className="font-headline text-[12px] font-bold uppercase tracking-widest text-white/70">
                      {displayName}
                    </span>
                  )}
                  <svg className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {open && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-52 bg-[#0f0f0f] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-white/40">Account</div>
                      {displayName && (
                        <div className="font-headline text-[13px] font-bold text-white mt-0.5 truncate">{orgName}</div>
                      )}
                    </div>
                    <div className="py-1.5">
                      <Link href="/organiser/profile" onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                        <User className="w-4 h-4 shrink-0" /> My Profile
                      </Link>
                      <Link href="/organiser/new-listing" onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                        <Plus className="w-4 h-4 shrink-0" /> Post an Event
                      </Link>
                      <button onClick={openSettings}
                        className="w-full flex items-center gap-3 px-4 py-2.5 font-headline text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                        <Settings className="w-4 h-4 shrink-0" /> Settings
                      </button>
                    </div>
                    <div className="border-t border-white/10 py-1.5">
                      <Link href="/"
                        onClick={() => setOpen(false)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 font-headline text-[13px] font-bold uppercase tracking-widest text-primary/80 hover:text-primary hover:bg-white/5 transition-colors">
                        <ArrowLeft className="w-4 h-4 shrink-0" />
                        Switch to Customer
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 font-headline text-[13px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors">
                        <LogOut className="w-4 h-4 shrink-0" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </nav>
  );
}
