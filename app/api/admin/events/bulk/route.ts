import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { hasAbn } from "@/lib/abn";
import { eventTimeData } from "@/lib/event-time";
import { effectiveEventStatus } from "@/lib/event-lifecycle";
import { syncEventSchedules, type SchedulableEvent } from "@/lib/event-scheduler";
import { z } from "zod";

const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1).max(255)).min(1).max(50),
  action: z.enum(["approve", "reject", "delete"]),
  reason: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = bulkActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const { ids, action, reason } = parsed.data;

  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "A rejection reason is required for bulk reject." }, { status: 400 });
  }

  try {
    let affected = 0;
    let blocked: { id: string; title: string; reason: string }[] = [];

    if (action === "delete") {
      const result = await prisma.event.deleteMany({ where: { id: { in: ids } } });
      affected = result.count;
    } else {
      if (action === "approve") {
        const candidates = await prisma.event.findMany({
          where:  { id: { in: ids }, status: "PENDING" },
          select: {
            id: true, title: true, registrationType: true,
            eventDate: true, endDate: true, startTime: true, endTime: true, state: true,
            organiser: { select: { abn: true, stripeOnboardingComplete: true } },
          },
        });
        const blockedFor = (e: (typeof candidates)[number]): string | null => {
          if (e.registrationType !== "startline") return null;
          if (!hasAbn(e.organiser.abn)) return "No ABN on file";
          if (!e.organiser.stripeOnboardingComplete) return "Stripe onboarding incomplete";
          return null;
        };
        blocked = candidates
          .map((e) => ({ id: e.id, title: e.title, reason: blockedFor(e) }))
          .filter((e): e is { id: string; title: string; reason: string } => e.reason !== null);
        const blockedIds = new Set(blocked.map((e) => e.id));
        const approvable = candidates.filter((e) => !blockedIds.has(e.id));

        // The effective status may be IN_PROGRESS or ARCHIVED when an admin
        // approves an old submission. Group by it so one update can still set
        // the right state for each event.
        const byStatus = new Map<string, typeof approvable>();
        for (const candidate of approvable) {
          const status = effectiveEventStatus({
            status: "APPROVED",
            ...eventTimeData(candidate),
          });
          byStatus.set(status, [...(byStatus.get(status) ?? []), candidate]);
        }

        let approvedCount = 0;
        for (const [status, group] of byStatus) {
          const result = await prisma.event.updateMany({
            where: { id: { in: group.map((e) => e.id) }, status: "PENDING" },
            data: {
              status: status as import("@prisma/client").EventStatus,
              reviewedById: session.sub,
              reviewedAt: new Date(),
              rejectionReason: null,
            },
          });
          approvedCount += result.count;
        }
        affected = approvedCount;

        const schedulable = approvable
          .map((e) => ({
            id: e.id,
            status: effectiveEventStatus({ status: "APPROVED", ...eventTimeData(e) }),
            ...eventTimeData(e),
          }))
          .filter((e) => e.status === "APPROVED" || e.status === "IN_PROGRESS");
        await Promise.all(
          schedulable.map((e) =>
            syncEventSchedules(e as SchedulableEvent).catch((err) =>
              console.error(`Event lifecycle schedule sync failed for ${e.id}:`, err),
            ),
          ),
        );
      } else {
        const result = await prisma.event.updateMany({
          where: { id: { in: ids }, status: "PENDING" },
          data: {
            status: "REJECTED",
            reviewedById: session.sub,
            reviewedAt: new Date(),
            rejectionReason: reason!.trim(),
          },
        });
        affected = result.count;
      }
    }

    writeAuditLog({
      adminId: session.sub,
      action: `BULK_${action.toUpperCase()}`,
      targetType: "event",
      targetId: ids.join(","),
      meta: { count: affected, reason: reason ?? null, blocked: blocked.length },
    });

    return NextResponse.json({ ok: true, affected, blocked });
  } catch (err) {
    console.error("Admin bulk action error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
