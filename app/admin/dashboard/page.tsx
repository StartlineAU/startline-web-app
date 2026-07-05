import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { archivePastEvents } from "@/lib/archive-events";
import AdminNav from "@/components/admin/AdminNav";
import { ArrowRight, Clock, CheckCircle, XCircle, Users, UserCircle, ClipboardList, BarChart2, ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

async function getStats() {
  await archivePastEvents();
  try {
    const [pending, approved, rejected, organisers, users, registrations] = await Promise.all([
      prisma.event.count({ where: { status: "PENDING"   } }),
      prisma.event.count({ where: { status: "APPROVED"  } }),
      prisma.event.count({ where: { status: "REJECTED"  } }),
      prisma.organiser.count(),
      prisma.user.count(),
      prisma.registration.count({ where: { status: "CONFIRMED" } }),
    ]);
    return { pending, approved, rejected, organisers, users, registrations };
  } catch (err) {
    console.error("Admin dashboard stats error:", err);
    return { pending: 0, approved: 0, rejected: 0, organisers: 0, users: 0, registrations: 0 };
  }
}

interface StatCardProps {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  accent?: string;
  href?: string;
}

function StatCard({ label, value, sub, icon, accent = "text-light", href }: StatCardProps) {
  const inner = (
    <div className="p-6 bg-dark border border-dark-lighter rounded-xl hover:border-dark-lighter/80 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="font-headline text-[10px] uppercase tracking-widest text-muted">{label}</div>
        <div className="text-muted-dark">{icon}</div>
      </div>
      <div className={`font-headline text-5xl font-black italic tracking-tighter leading-none mb-3 ${accent}`}>
        {value}
      </div>
      <div className="text-[12px] text-muted">{sub}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:scale-[1.01] transition-transform">
        {inner}
      </Link>
    );
  }

  return <div>{inner}</div>;
}

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const stats = await getStats();

  return (
    <div className="min-h-screen bg-dark-darker">
      <AdminNav />

      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-primary mb-3">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none text-light">
                Overview.<br />
                <span className={stats.pending > 0 ? "text-primary" : "text-muted"}>
                  {stats.pending > 0
                    ? `${stats.pending} event${stats.pending !== 1 ? "s" : ""} need review.`
                    : "Queue is clear."}
                </span>
              </h1>
              <p className="text-muted mt-4 text-[15px]">
                Signed in as <span className="font-medium text-light">{session.email}</span>
              </p>
            </div>

            {stats.pending > 0 && (
              <Link
                href="/admin/events?status=PENDING"
                className="self-start lg:self-end inline-flex items-center gap-2 bg-machined shadow-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
              >
                Review queue <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            <StatCard
              label="Pending review"
              value={stats.pending}
              sub="awaiting admin action"
              icon={<Clock className="w-5 h-5" />}
              accent={stats.pending > 0 ? "text-blue-300" : "text-light"}
              href="/admin/events?status=PENDING"
            />
            <StatCard
              label="Published events"
              value={stats.approved}
              sub="approved and live"
              icon={<CheckCircle className="w-5 h-5" />}
              accent="text-primary"
              href="/admin/events?status=APPROVED"
            />
            <StatCard
              label="Rejected"
              value={stats.rejected}
              sub="not approved"
              icon={<XCircle className="w-5 h-5" />}
              accent={stats.rejected > 0 ? "text-red-400" : "text-light"}
              href="/admin/events?status=REJECTED"
            />
            <StatCard
              label="Organisers"
              value={stats.organisers}
              sub="registered accounts"
              icon={<Users className="w-5 h-5" />}
              href="/admin/organisers"
            />
            <StatCard
              label="Users"
              value={stats.users}
              sub="athlete accounts"
              icon={<UserCircle className="w-5 h-5" />}
              href="/admin/users"
            />
            <StatCard
              label="Registrations"
              value={stats.registrations}
              sub="confirmed entries"
              icon={<ClipboardList className="w-5 h-5" />}
              href="/admin/registrations"
            />
          </div>

          {/* Quick links */}
          <div>
            <h2 className="font-headline text-xl font-black italic tracking-tighter text-light mb-4">
              Quick actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  href:  "/admin/events?status=PENDING",
                  label: "Review pending events",
                  sub:   stats.pending > 0 ? `${stats.pending} submission${stats.pending !== 1 ? "s" : ""} waiting` : "No submissions waiting",
                },
                {
                  href:  "/admin/events",
                  label: "All events",
                  sub:   "Browse, pin, delete and manage every event",
                },
                {
                  href:  "/admin/organisers",
                  label: "Organisers",
                  sub:   "Verify, suspend, and manage organiser accounts",
                },
                {
                  href:  "/admin/users",
                  label: "Users",
                  sub:   "Manage athlete accounts",
                },
                {
                  href:  "/admin/registrations",
                  label: "Registrations",
                  sub:   "View entries and issue refunds",
                },
                {
                  href:  "/admin/reviews",
                  label: "Moderate reviews",
                  sub:   "Publish, verify or remove athlete reviews",
                },
                {
                  href:  "/admin/analytics",
                  label: "Analytics",
                  sub:   "Revenue, registrations and platform health",
                  icon:  <BarChart2 className="w-5 h-5 text-muted-dark group-hover:text-primary transition-colors" />,
                },
                {
                  href:  "/admin/audit",
                  label: "Audit log",
                  sub:   "Full record of every admin action",
                  icon:  <ScrollText className="w-5 h-5 text-muted-dark group-hover:text-primary transition-colors" />,
                },
              ].map(({ href, label, sub, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between p-5 bg-dark border border-dark-lighter rounded-xl hover:border-primary/40 hover:bg-dark-light transition-all group"
                >
                  <div>
                    <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-light mb-1">
                      {label}
                    </div>
                    <div className="text-[13px] text-muted">{sub}</div>
                  </div>
                  {icon ?? <ArrowRight className="w-5 h-5 text-muted-dark group-hover:text-primary transition-colors" />}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
