import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geocodePlace } from "@/lib/geocode";
import { rateLimitPaid } from "@/lib/rate-limit";

const geocodeQuery = z.object({ q: z.string().trim().max(300).catch("") });

export async function GET(req: NextRequest) {
  const { q } = geocodeQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q) return NextResponse.json({ result: null });

  // Public event search needs this route, so it cannot require a session. It
  // is limited per caller and by the shared billable-lookup budget instead.
  // The limiter is checked before AWS, so an over-limit request never spends.
  const blocked = await rateLimitPaid(req, {
    prefix: "places-geocode",
    limit: 30,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  const result = await geocodePlace(q);
  return NextResponse.json({ result });
}
