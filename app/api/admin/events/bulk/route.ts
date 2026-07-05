import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json() as { ids?: string[]; action?: string; reason?: string };
  const { ids, action, reason } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array." }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: "Maximum 50 events per bulk action." }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject" && action !== "delete") {
    return NextResponse.json({ error: "action must be approve, reject, or delete." }, { status: 400 });
  }
  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "A rejection reason is required for bulk reject." }, { status: 400 });
  }

  try {
    let affected = 0;

    if (action === "delete") {
      const result = await prisma.event.deleteMany({ where: { id: { in: ids } } });
      affected = result.count;
    } else {
      const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
      const result = await prisma.event.updateMany({
        where: { id: { in: ids }, status: "PENDING" },
        data: {
          status: newStatus,
          reviewedById: session.sub,
          reviewedAt: new Date(),
          ...(action === "reject"
            ? { rejectionReason: reason!.trim() }
            : { rejectionReason: null }),
        },
      });
      affected = result.count;
    }

    writeAuditLog({
      adminId: session.sub,
      action: `BULK_${action.toUpperCase()}`,
      targetType: "event",
      targetId: ids.join(","),
      meta: { count: affected, reason: reason ?? null },
    });

    return NextResponse.json({ ok: true, affected });
  } catch (err) {
    console.error("Admin bulk action error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
