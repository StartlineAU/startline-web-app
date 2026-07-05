import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";
import AdminNav from "@/components/admin/AdminNav";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp, DollarSign, Users, CalendarDays,
  CheckCircle, Clock, XCircle, Archive,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface AnalyticsData {
  events: { draft: number; pending: number; approved: number; rejected: number; archived: number };
  registrations: { total: number; revenueAud: number; platformFeeAud: number };
  topEvents: { id: string; title: string; city: string; state: string; eventDate: string; registrationCount: number }[];
  organisers: { active: number; suspended: number };
  users: { total: number };
  registrationsByMonth: { month: string; count: number }[];
}

function formatAud(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatMonth(ym: string) {
  try {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-AU", {
      month: "short", year: "2-digit",
    });
  } catch {
    return ym;
  }
}

async function getAnalytics(): Promise<AnalyticsData | null> {
  try {
    const [
      eventsByStatus,
      confirmedCount,
      revenueAgg,
      platformFeeAgg,
      topEvents,
      organisersByStatus,
      totalUsers,
      recentMonths,
    ] = await Promise.all([
      prisma.event.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.registration.count({ where: { status: "CONFIRMED" } }),
      prisma.registration.aggregate({ where: { status: "CONFIRMED" }, _sum: { amountCents: true } }),
      prisma.registration.aggregate({ where: { status: "CONFIRMED" }, _sum: { platformFeeCents: true } }),
      prisma.event.findMany({
        where: { status: "APPROVED" },
        orderBy: { registrations: { _count: "desc" } },
        take: 5,
        select: { id: true, title: true, city: true, state: true, eventDate: true, _count: { select: { registrations: true } } },
      }),
      prisma.organiser.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.user.count(),
      prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT TO_CHAR("createdAt", 'YYYY-MM') AS month, COUNT(*)::bigint AS count
        FROM registrations
        WHERE "createdAt" >= NOW() - INTERVAL '6 months' AND status = 'CONFIRMED'
        GROUP BY month ORDER BY month ASC
      `,
    ]);

    const statusMap          = Object.fromEntries(eventsByStatus.map((r)    => [r.status,  r._count.id]));
    const organiserStatusMap = Object.fromEntries(organisersByStatus.map((r) => [r.status, r._count.id]));

    return {
      events: {
        draft:    statusMap["DRAFT"]    ?? 0,
        pending:  statusMap["PENDING"]  ?? 0,
        approved: statusMap["APPROVED"] ?? 0,
        rejected: statusMap["REJECTED"] ?? 0,
        archived: statusMap["ARCHIVED"] ?? 0,
      },
      registrations: {
        total:          confirmedCount,
        revenueAud:     (revenueAgg._sum.amountCents       ?? 0) / 100,
        platformFeeAud: (platformFeeAgg._sum.platformFeeCents ?? 0) / 100,
      },
      topEvents: topEvents.map((e) => ({
        id: e.id, title: e.title, city: e.city, state: e.state,
        eventDate: e.eventDate, registrationCount: e._count.registrations,
      })),
      organisers: {
        active:    organiserStatusMap["APPROVED"]  ?? 0,
        suspended: organiserStatusMap["SUSPENDED"] ?? 0,
      },
      users: { total: totalUsers },
      registrationsByMonth: recentMonths.map((r) => ({ month: r.month, count: Number(r.count) })),
    };
  } catch (err) {
    console.error("Analytics fetch error:", err);
    return null;
  }
}

export default async function AdminAnalyticsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const data = await getAnalytics();
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <main className="pt-14">
          <div className="max-w-[1200px] mx-auto px-6 py-10">
            <p className="text-gray-500">Failed to load analytics data.</p>
          </div>
        </main>
      </div>
    );
  }

  const totalEvents  = data.events.approved + data.events.pending + data.events.rejected + data.events.archived + data.events.draft;
  const maxRegMonth  = Math.max(...data.registrationsByMonth.map((r) => r.count), 1);
  const maxTopEvent  = Math.max(...data.topEvents.map((e) => e.registrationCount), 1);
  const avgRevenue   = data.registrations.total > 0
    ? data.registrations.revenueAud / data.registrations.total
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 py-10 page-in">

          {/* Header */}
          <div className="mb-10">
            <div className="font-headline text-[11px] font-bold uppercase tracking-[0.25em] text-lime-600 mb-2">
              Admin portal
            </div>
            <h1 className="font-headline text-[44px] lg:text-[56px] font-black italic tracking-tighter leading-none text-gray-900">
              Analytics.
            </h1>
          </div>

          {/* Revenue + Registration KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "Total GMV",
                value: formatAud(data.registrations.revenueAud),
                sub:   "gross athlete payments",
                icon:  <DollarSign className="w-5 h-5" />,
                accent: "text-lime-600",
              },
              {
                label: "Platform revenue",
                value: formatAud(data.registrations.platformFeeAud),
                sub:   "Startline fee collected",
                icon:  <TrendingUp className="w-5 h-5" />,
                accent: "text-lime-600",
              },
              {
                label: "Registrations",
                value: data.registrations.total.toLocaleString(),
                sub:   "confirmed entries",
                icon:  <Users className="w-5 h-5" />,
                accent: "text-gray-900",
              },
              {
                label: "Avg per entry",
                value: formatAud(avgRevenue),
                sub:   "average ticket value",
                icon:  <CalendarDays className="w-5 h-5" />,
                accent: "text-gray-900",
              },
            ].map(({ label, value, sub, icon, accent }) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="font-headline text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
                    <div className="text-gray-400">{icon}</div>
                  </div>
                  <div className={`font-headline text-3xl font-black italic tracking-tighter leading-none mb-1.5 ${accent}`}>
                    {value}
                  </div>
                  <div className="text-[11px] text-gray-400">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Registrations by month */}
            <Card>
              <CardContent className="p-6">
                <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-5">
                  Registrations — last 6 months
                </div>
                {data.registrationsByMonth.length === 0 ? (
                  <div className="text-[13px] text-gray-400 py-6 text-center">No data yet</div>
                ) : (
                  <div className="flex items-end gap-2 h-36">
                    {data.registrationsByMonth.map((r) => (
                      <div key={r.month} className="flex-1 flex flex-col items-center gap-1.5">
                        <div className="font-headline text-[10px] text-gray-600 tabular-nums">{r.count}</div>
                        <div
                          className="w-full bg-lime-400 rounded-sm transition-all"
                          style={{ height: `${Math.max(4, (r.count / maxRegMonth) * 100)}px` }}
                        />
                        <div className="font-headline text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">
                          {formatMonth(r.month)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Events by status */}
            <Card>
              <CardContent className="p-6">
                <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-5">
                  Events by status
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Approved", value: data.events.approved, icon: <CheckCircle className="w-4 h-4 text-lime-500" />, color: "bg-lime-400" },
                    { label: "Pending",  value: data.events.pending,  icon: <Clock className="w-4 h-4 text-blue-500" />,       color: "bg-blue-400" },
                    { label: "Archived", value: data.events.archived, icon: <Archive className="w-4 h-4 text-gray-400" />,     color: "bg-gray-300" },
                    { label: "Rejected", value: data.events.rejected, icon: <XCircle className="w-4 h-4 text-red-400" />,     color: "bg-red-400"  },
                    { label: "Draft",    value: data.events.draft,    icon: <Clock className="w-4 h-4 text-gray-300" />,       color: "bg-gray-200" },
                  ].map(({ label, value, icon, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      {icon}
                      <div className="font-headline text-[12px] uppercase tracking-widest text-gray-600 w-20 shrink-0">
                        {label}
                      </div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: totalEvents > 0 ? `${(value / totalEvents) * 100}%` : "0%" }}
                        />
                      </div>
                      <div className="font-headline text-[13px] font-bold text-gray-900 w-8 text-right tabular-nums">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top events by registrations */}
            <Card>
              <CardContent className="p-6">
                <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-5">
                  Top events by registrations
                </div>
                {data.topEvents.length === 0 ? (
                  <div className="text-[13px] text-gray-400 py-6 text-center">No approved events yet</div>
                ) : (
                  <div className="space-y-4">
                    {data.topEvents.map((e, i) => (
                      <div key={e.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-headline text-[11px] font-bold text-gray-400 shrink-0 w-5">
                              {i + 1}.
                            </span>
                            <div className="min-w-0">
                              <div className="font-headline text-[13px] font-bold italic tracking-tight text-gray-900 truncate">
                                {e.title}
                              </div>
                              <div className="font-headline text-[10px] uppercase tracking-widest text-gray-400">
                                {e.city}, {e.state.toUpperCase()} · {formatDate(e.eventDate)}
                              </div>
                            </div>
                          </div>
                          <span className="font-headline text-[13px] font-bold text-gray-900 shrink-0 ml-2">
                            {e.registrationCount}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-lime-400 rounded-full"
                            style={{ width: `${(e.registrationCount / maxTopEvent) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Platform health */}
            <Card>
              <CardContent className="p-6">
                <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-5">
                  Platform health
                </div>
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-headline text-[12px] uppercase tracking-widest text-gray-600">Total users</span>
                      <span className="font-headline text-[22px] font-black italic tracking-tighter text-gray-900">
                        {data.users.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-5">
                    <div className="font-headline text-[11px] uppercase tracking-widest text-gray-400 mb-3">Organisers</div>
                    <div className="space-y-2">
                      {[
                        { label: "Active",    value: data.organisers.active,    color: "bg-lime-400" },
                        { label: "Suspended", value: data.organisers.suspended, color: "bg-red-400"  },
                      ].map(({ label, value, color }) => {
                        const total = data.organisers.active + data.organisers.suspended;
                        return (
                          <div key={label} className="flex items-center gap-3">
                            <div className="font-headline text-[12px] uppercase tracking-widest text-gray-500 w-20 shrink-0">
                              {label}
                            </div>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${color} rounded-full`}
                                style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }}
                              />
                            </div>
                            <div className="font-headline text-[13px] font-bold text-gray-900 w-8 text-right">
                              {value}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
}
