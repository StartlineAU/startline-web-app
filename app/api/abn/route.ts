import { NextRequest, NextResponse } from "next/server";
import { lookupAbn } from "@/lib/abn";

export async function GET(req: NextRequest) {
  const abn = req.nextUrl.searchParams.get("abn");
  if (!abn) return NextResponse.json({ error: "abn query param required." }, { status: 400 });

  if (!process.env.ABR_GUID) {
    return NextResponse.json({ error: "ABR_GUID not configured." }, { status: 503 });
  }

  const result = await lookupAbn(abn);
  if (!result) return NextResponse.json({ error: "ABN not found." }, { status: 404 });

  return NextResponse.json(result);
}
