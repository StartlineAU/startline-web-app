import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/amplify-server";
import { idParams } from "@/lib/schemas";
import { writeAuditLog } from "@/lib/audit";
import { syncEventSchedules } from "@/lib/event-scheduler";
import { notifyEventChange } from "@/lib/notify-event-change";
import { notifyOrganiserRevisionDecision } from "@/lib/notify-event-revision";
import {
  RevisionError,
  applyPendingRevision,
  pendingRevision,
  rejectPendingRevision,
} from "@/lib/event-revision";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
});

// GET — the edit waiting on a published event, for the admin preview.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  return NextResponse.json({ revision: await pendingRevision(parsedParams.data.id) });
}

// POST — approve applies the queued edit. Reject leaves the live listing as it is.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const { action, reason } = parsedBody.data;

  try {
    if (action === "reject") {
      const rejected = await rejectPendingRevision({
        eventId: id,
        reviewedById: session.sub,
        reason: reason ?? "",
      });
      await writeAuditLog({
        adminId: session.sub,
        action: "REJECT_EVENT_REVISION",
        targetType: "event",
        targetId: id,
        meta: { title: rejected.title, reason: reason?.trim() },
      });
      await notifyOrganiserRevisionDecision({ eventId: id, approved: false, reason: reason?.trim() })
        .catch((err) => console.error("Revision decision notify failed:", err));
      return NextResponse.json({ status: "REJECTED" });
    }

    const applied = await applyPendingRevision({ eventId: id, reviewedById: session.sub });
    await syncEventSchedules(applied.updated).catch((err) =>
      console.error("Event lifecycle schedule sync failed:", err),
    );
    if (applied.changes.length > 0) {
      await notifyEventChange({
        eventId: applied.eventId,
        changes: applied.changes,
      }).catch((err) => console.error("Event change notify failed:", err));
    }
    await writeAuditLog({
      adminId: session.sub,
      action: "APPROVE_EVENT_REVISION",
      targetType: "event",
      targetId: id,
      meta: { title: applied.title },
    });
    await notifyOrganiserRevisionDecision({ eventId: id, approved: true })
      .catch((err) => console.error("Revision decision notify failed:", err));
    return NextResponse.json({ status: "APPROVED" });
  } catch (err) {
    if (err instanceof RevisionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("Event revision review failed:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
