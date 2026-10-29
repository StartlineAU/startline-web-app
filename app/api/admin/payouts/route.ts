import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/amplify-server";
import {
  getPayoutAttention,
  getPayoutEligibleEvents,
  PayoutError,
  runPayoutForEvent,
} from "@/lib/payout";
import { z } from "zod";

const payoutSchema = z.object({ eventId: z.string().min(1).max(255) });

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  try {
    const [events, attention] = await Promise.all([
      getPayoutEligibleEvents(),
      getPayoutAttention(),
    ]);
    return NextResponse.json({ events, attention });
  } catch (err) {
    console.error("Admin payout list error:", err);
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const parsed = payoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  const eventId = parsed.data.eventId;

  try {
    const result = await runPayoutForEvent(eventId);
    return NextResponse.json({
      ok: true,
      eventId,
      netCents: result.netCents,
      stripePayoutId: result.stripePayoutId,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err) {
    if (err instanceof PayoutError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("Admin payout error:", err);
    return NextResponse.json({ error: "Payout failed." }, { status: 503 });
  }
}
