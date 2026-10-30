import { NextRequest, NextResponse } from "next/server";
import { lookupAbn } from "@/lib/abn";
import { getServerSession } from "@/lib/amplify-server";
import { rateLimitPaid } from "@/lib/rate-limit";
import { z } from "zod";

const abnQuery = z.object({ abn: z.string().trim().min(1).max(20) });

export async function GET(req: NextRequest) {
  // The ABN is only collected after someone signs in to set up an organiser.
  // Requiring a session keeps an anonymous caller from spending the ABR quota.
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to check an ABN." }, { status: 401 });
  }

  const parsed = abnQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "abn query param required." }, { status: 400 });
  const { abn } = parsed.data;

  if (!process.env.ABR_GUID) {
    return NextResponse.json({ error: "ABR_GUID not configured." }, { status: 503 });
  }

  const blocked = await rateLimitPaid(req, {
    prefix: "abn-lookup",
    limit: 20,
    windowSeconds: 60,
    identifier: session.sub,
  });
  if (blocked) return blocked;

  const result = await lookupAbn(abn);
  if (!result) return NextResponse.json({ error: "ABN not found." }, { status: 404 });

  return NextResponse.json(result);
}
