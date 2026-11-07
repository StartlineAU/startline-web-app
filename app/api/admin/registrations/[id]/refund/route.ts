import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";
import { RefundError, issueEntryRefund, refundEntrySelect } from "@/lib/issue-entry-refund";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  try {
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: { ...refundEntrySelect, fullRefundUntil: true },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    // A request frozen as FULL stays FULL. So does a confirmed entry the
    // organiser's change made eligible: the admin refunding it is honouring the
    // athlete's entitlement, not the event's ordinary tiers.
    const type =
      registration.refundType === "FULL" ||
      (registration.status === "CONFIRMED" &&
        registration.fullRefundUntil != null &&
        registration.fullRefundUntil.getTime() > Date.now())
        ? "FULL"
        : "NORMAL";

    const result = await issueEntryRefund(registration, type);

    await writeAuditLog({
      adminId: session.sub,
      action: "REFUND_REGISTRATION",
      targetType: "registration",
      targetId: id,
      meta: result.method === "free"
        ? { method: "free", athleteName: registration.athleteName }
        : {
            stripeRefundId: result.refundId,
            refundType: result.type,
            refundCents: result.refundCents,
            amountCents: registration.amountCents,
            athleteName: registration.athleteName,
            ...(result.type === "FULL" ? { recoveryOutstandingCents: result.recoveryOutstandingCents } : {}),
          },
    });

    return result.method === "free"
      ? NextResponse.json({ ok: true, method: "free" })
      : NextResponse.json({ ok: true, refundId: result.refundId, refundType: result.type });
  } catch (err) {
    if (err instanceof RefundError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Admin refund error:", err);
    return NextResponse.json({ error: "Refund failed." }, { status: 503 });
  }
}
