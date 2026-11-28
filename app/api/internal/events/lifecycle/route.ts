import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  LIVE_EVENT_STATUSES,
  refreshEventLifecycle,
  transitionDueEvents,
} from "@/lib/event-lifecycle";
import { syncEventSchedules, type SchedulableEvent } from "@/lib/event-scheduler";
import {
  eventsOwingCancellationRefunds,
  processCancellationRefunds,
} from "@/lib/event-cancellation";
import { notifyEventFinished, notifyFinishedEvents } from "@/lib/notify-event-finished";

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

  const refreshed = eventId ? await refreshEventLifecycle(eventId, now) : null;

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

  // A cancelled event owes every entrant a full refund. Anything that failed
  // when it was cancelled (Stripe down, a balance shortfall) is retried on
  // every sweep until it goes through.
  const cancellationRefunds = { events: 0, refunded: 0, failed: 0 };
  if (sweep) {
    for (const owingEventId of await eventsOwingCancellationRefunds()) {
      try {
        const result = await processCancellationRefunds(owingEventId);
        cancellationRefunds.events++;
        cancellationRefunds.refunded += result.refunded;
        cancellationRefunds.failed += result.failed;
      } catch (err) {
        console.error(`Cancellation refund retry failed for ${owingEventId}:`, err);
      }
    }
  }

  // Tell each organisation its event has finished (#561). Runs after the
  // transitions above so an event archived on this tick is announced on it.
  let finishedNotices = 0;
  try {
    if (sweep) {
      finishedNotices = await notifyFinishedEvents(now);
    } else if (eventId && refreshed === "ARCHIVED") {
      finishedNotices = (await notifyEventFinished(eventId, now)) ? 1 : 0;
    }
  } catch (err) {
    console.error("Event finished notices failed:", err);
  }

  return NextResponse.json({
    ok: true,
    checked: events.length,
    archived: transitions.archived,
    started: transitions.started,
    scheduleFailures: failures.length,
    cancellationRefunds,
    finishedNotices,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
