import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolvePlace } from "@/lib/geocode";
import { rateLimitPaid } from "@/lib/rate-limit";

const resolveQuery = z.object({ q: z.string().trim().min(2).max(300).catch("") });

/**
 * Resolve the public search bar's free text to one place, or to a state choice
 * when the name is ambiguous (#352). The organiser address fields keep using
 * /api/places/geocode, which always takes the best single match.
 */
export async function GET(req: NextRequest) {
  const { q } = resolveQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q) return NextResponse.json({ result: null, choices: [] });

  const blocked = await rateLimitPaid(req, {
    prefix: "places-resolve",
    limit: 30,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  return NextResponse.json(await resolvePlace(q));
}
