import prisma from "./prisma";
import { reportCaught } from "./error-reporting";

// Awaited by every caller: on Lambda an unawaited write can be lost when the
// container freezes after the response. A failure does not undo the admin's
// change, which has already happened, but it does reach the error alarm.

export async function writeAuditLog(params: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId:    params.adminId,
        action:     params.action,
        targetType: params.targetType,
        targetId:   params.targetId,
        meta:       params.meta as any,
      },
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
    reportCaught(err, "audit:write");
  }
}
