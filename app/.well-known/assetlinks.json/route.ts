import { NextResponse } from "next/server";
import { androidAssetLinks } from "@/lib/mobile-app";

// Android verifies the app's autoVerify intent filter against this file, so
// startlineau.com links open the mobile app without a chooser.
export const dynamic = "force-static";

export function GET() {
  const body = androidAssetLinks();
  if (!body) return new NextResponse(null, { status: 404 });
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
