import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  LIVE_EVENT_STATUSES,
  refreshEventLifecycle,
  transitionDueEvents,
} from "@/lib/event-lifecycle";
import { syncEventSchedules, type SchedulableEvent } from "@/lib/event-scheduler";

export const dynamic = "force-dynamic";

function authorised(req: NextRequest): boolean {
  const expected = process.env.EVENT_LIFECYCLE_SECRET;
  if (!expected) return false;

  const provided = req.headers.get("x-event-lifecycle-secret") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The only writer that advances event time. Invoked by the scheduled Lambda
 * and by a manual run, never by an athlete-facing read.
 *
 * A targeted call re-reads and refreshes one event; a sweep also reconciles
 * every live event's one-time triggers, repairing anything missed while a
 * schedule was being created or an event was being edited.
 */
async function run(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const now = new Date();
  const eventId = req.nextUrl.searchParams.get("eventId")?.trim() || null;
  const sweep = req.nextUrl.searchParams.get("sweep") === "1" || !eventId;

  if (eventId) await refreshEventLifecycle(eventId, now);

  const transitions = sweep
    ? await transitionDueEvents(now)
    : { archived: 0, started: 0 };

  const events = await prisma.event.findMany({
    where: {
      ...(eventId
        ? { id: eventId }
        : { status: { in: [...LIVE_EVENT_STATUSES] } }),
    },
    orderBy: { endsAtUtc: "asc" },
    take: sweep ? 500 : 1,
    select: { id: true, status: true, startsAtUtc: true, endsAtUtc: true },
  });

  const failures: string[] = [];
  for (const event of events) {
    try {
      await syncEventSchedules(event as SchedulableEvent, now);
    } catch (err) {
      failures.push(event.id);
      console.error(`Event lifecycle schedule sync failed for ${event.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: events.length,
    archived: transitions.archived,
    started: transitions.started,
    scheduleFailures: failures.length,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
