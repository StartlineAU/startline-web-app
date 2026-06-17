import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { archivePastEvents } from "@/lib/archive-events";
import AdminNav from "@/components/admin/AdminNav";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, CheckCircle, XCircle, Users } from "lucide-react";

export const dynamic = "force-dynamic";

async function getStats() {
  await archivePastEvents();
  try {
    const [pending, approved, rejected, organisers] = await Promise.all([
      prisma.event.count({ where: { status: "PENDING"  } }),
      prisma.event.count({ where: { status: "APPROVED" } }),
      prisma.event.count({ where: { status: "REJECTED" } }),
      prisma.organiser.count(),
    ]);
    return { pending, approved, rejected, organisers };
  } catch (err) {
    console.error("Admin dashboard stats error:", err);
    return { pending: 0, approved: 0, rejected: 0, organisers: 0 };
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

function StatCard({ label, value, sub, icon, accent = "text-gray-900", href }: StatCardProps) {
  const inner = (
    <CardContent className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="font-headline text-[11px] uppercase tracking-widest text-gray-500">{label}</div>
        <div className="text-gray-400">{icon}</div>
      </div>
      <div className={`font-headline text-5xl font-black italic tracking-tighter leading-none mb-3 ${accent}`}>
        {value}
      </div>
      <div className="text-[12px] text-gray-500">{sub}</div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">{inner}</Card>
      </Link>
    );
  }

  return <Card>{inner}</Card>;
}

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const stats = await getStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="pt-16">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-3">
                Admin portal
              </div>
              <h1 className="font-headline text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none text-gray-900">
                Overview.<br />
                <span className="text-lime-500">
                  {stats.pending > 0
                    ? `${stats.pending} event${stats.pending !== 1 ? "s" : ""} need review.`
                    : "Queue is clear."}
                </span>
              </h1>
              <p className="text-gray-500 mt-4 text-[15px]">
                Signed in as <span className="font-medium text-gray-700">{session.email}</span>
              </p>
            </div>

            {stats.pending > 0 && (
              <Link
                href="/admin/events?status=PENDING"
                className="self-start lg:self-end inline-flex items-center gap-2 bg-gray-900 text-white font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
              >
                Review queue <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard
              label="Pending review"
              value={stats.pending}
              sub="awaiting admin action"
              icon={<Clock className="w-5 h-5" />}
              accent={stats.pending > 0 ? "text-blue-600" : "text-gray-900"}
              href="/admin/events?status=PENDING"
            />
            <StatCard
              label="Published events"
              value={stats.approved}
              sub="approved and published"
              icon={<CheckCircle className="w-5 h-5" />}
              accent="text-lime-600"
              href="/admin/events?status=APPROVED"
            />
            <StatCard
              label="Rejected"
              value={stats.rejected}
              sub="not approved"
              icon={<XCircle className="w-5 h-5" />}
              accent={stats.rejected > 0 ? "text-red-500" : "text-gray-900"}
              href="/admin/events?status=REJECTED"
            />
            <StatCard
              label="Organisers"
              value={stats.organisers}
              sub="registered accounts"
              icon={<Users className="w-5 h-5" />}
              href="/admin/organisers"
            />
          </div>

          {/* Quick links */}
          <div>
            <h2 className="font-headline text-xl font-black italic tracking-tighter text-gray-900 mb-4">
              Quick actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/admin/events?status=PENDING"
                className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group"
              >
                <div>
                  <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-gray-900 mb-1">
                    Review pending events
                  </div>
                  <div className="text-[13px] text-gray-500">
                    {stats.pending > 0
                      ? `${stats.pending} submission${stats.pending !== 1 ? "s" : ""} waiting`
                      : "No submissions waiting"}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
              </Link>

              <Link
                href="/admin/events"
                className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group"
              >
                <div>
                  <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-gray-900 mb-1">
                    All events
                  </div>
                  <div className="text-[13px] text-gray-500">
                    Browse and manage every event
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
              </Link>

              <Link
                href="/admin/organisers"
                className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group"
              >
                <div>
                  <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-gray-900 mb-1">
                    Organisers
                  </div>
                  <div className="text-[13px] text-gray-500">
                    View accounts, payout and listing activity
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
              </Link>

              <Link
                href="/admin/reviews"
                className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all group"
              >
                <div>
                  <div className="font-headline text-[13px] font-bold uppercase tracking-widest text-gray-900 mb-1">
                    Moderate reviews
                  </div>
                  <div className="text-[13px] text-gray-500">
                    Publish, verify or remove athlete reviews
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
