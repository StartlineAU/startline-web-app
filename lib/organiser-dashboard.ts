export type DashboardEventInput = {
  id: string;
  status: string;
  eventDate: string;
  cap: number | null;
};

export type DashboardRegistrationInput = {
  eventId: string;
  amountCents: number;
  platformFeeCents: number;
  createdAt: Date | string;
};

/** Local calendar day as YYYY-MM-DD. */
export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseEventDate(eventDate: string): Date | null {
  if (!eventDate) return null;
  const d = new Date(`${eventDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isWithinNextDays(eventDate: string, days: number, now = new Date()): boolean {
  const d = parseEventDate(eventDate);
  if (!d) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return d >= start && d <= end;
}

export function computeCapacityFilledPct(
  events: DashboardEventInput[],
  confirmedByEvent: Map<string, number>,
): number | null {
  let filled = 0;
  let capTotal = 0;
  for (const e of events) {
    if (e.status !== "APPROVED" || e.cap == null || e.cap <= 0) continue;
    capTotal += e.cap;
    filled += confirmedByEvent.get(e.id) ?? 0;
  }
  if (capTotal === 0) return null;
  return Math.min(100, Math.round((filled / capTotal) * 100));
}

export type TrendDay = {
  date: string;
  registrations: number;
  revenueCents: number;
  followers: number;
};

export function buildTrendDays(
  registrations: DashboardRegistrationInput[],
  days = 30,
  now = new Date(),
  followCreatedAts: Array<Date | string> = [],
): TrendDay[] {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const buckets = new Map<string, { registrations: number; revenueCents: number; followers: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(toDayKey(d), { registrations: 0, revenueCents: 0, followers: 0 });
  }

  for (const r of registrations) {
    const created = typeof r.createdAt === "string" ? new Date(r.createdAt) : r.createdAt;
    if (Number.isNaN(created.getTime())) continue;
    const key = toDayKey(created);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.registrations += 1;
    bucket.revenueCents += Math.max(0, r.amountCents - r.platformFeeCents);
  }

  for (const raw of followCreatedAts) {
    const created = typeof raw === "string" ? new Date(raw) : raw;
    if (Number.isNaN(created.getTime())) continue;
    const key = toDayKey(created);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.followers += 1;
  }

  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    registrations: v.registrations,
    revenueCents: v.revenueCents,
    followers: v.followers,
  }));
}

export function computeCurrentStats(
  events: DashboardEventInput[],
  confirmedByEvent: Map<string, number>,
  now = new Date(),
) {
  const liveEvents = events.filter((e) => e.status === "APPROVED");
  let liveRegistrations = 0;
  for (const e of liveEvents) {
    liveRegistrations += confirmedByEvent.get(e.id) ?? 0;
  }

  return {
    live: liveEvents.length,
    racingIn30Days: liveEvents.filter((e) => isWithinNextDays(e.eventDate, 30, now)).length,
    capacityFilledPct: computeCapacityFilledPct(events, confirmedByEvent),
    liveRegistrations,
  };
}

/**
 * Y-axis ticks for the trend chart: whole numbers from 0 up to a round value at
 * or above `max`, in steps of 1, 2 or 5 times a power of ten. Whole steps
 * because the axis labels are rounded, and fractional ticks on a small range
 * used to print as 0, 0, 1, 1, 1. An empty chart gets 0 to 4.
 */
export function trendAxisTicks(max: number): number[] {
  const top = max > 0 ? max : 4;
  const rough = top / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const count = Math.ceil(top / step);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

export function formatAudFromCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: dollars >= 1000 ? 0 : 2,
  }).format(dollars);
}
