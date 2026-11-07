import { NextResponse } from "next/server";
import { appleAppSiteAssociation } from "@/lib/mobile-app";

// iOS fetches this (through Apple's CDN) to decide whether startlineau.com
// links open the mobile app. It must be JSON, at this exact path, with no
// redirect, which a file in public/ without an extension would not give us.
export const dynamic = "force-static";

export function GET() {
  const body = appleAppSiteAssociation();
  if (!body) return new NextResponse(null, { status: 404 });
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
