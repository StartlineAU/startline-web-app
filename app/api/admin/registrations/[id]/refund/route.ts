import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/amplify-server";
import { writeAuditLog } from "@/lib/audit";
import { idParams } from "@/lib/schemas";
import { RefundError, issueEntryRefund, refundEntrySelect } from "@/lib/issue-entry-refund";
import { refundWithinCutoff } from "@/lib/refund-policy";

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
      select: {
        ...refundEntrySelect,
        event: { select: { id: true, title: true, startsAtUtc: true } },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    // Change-of-mind refunds stop 24 hours before the start. A free entry has
    // nothing to refund, and a cancellation is not a refund.
    const paid = registration.amountCents + registration.platformFeeCents > 0;
    if (paid && refundWithinCutoff(registration.event.startsAtUtc)) {
      return NextResponse.json(
        { error: "Refunds are not available within 24 hours of the event start." },
        { status: 409 },
      );
    }

    const result = await issueEntryRefund(registration);

    await writeAuditLog({
      adminId: session.sub,
      action: "REFUND_REGISTRATION",
      targetType: "registration",
      targetId: id,
      meta: result.method === "free"
        ? { method: "free", athleteName: registration.athleteName }
        : {
            stripeRefundId: result.refundId,
            refundCents: result.refundCents,
            amountCents: registration.amountCents,
            athleteName: registration.athleteName,
          },
    });

    return result.method === "free"
      ? NextResponse.json({ ok: true, method: "free" })
      : NextResponse.json({ ok: true, refundId: result.refundId });
  } catch (err) {
    if (err instanceof RefundError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Admin refund error:", err);
    return NextResponse.json({ error: "Refund failed." }, { status: 503 });
  }
}
