import { NextResponse } from "next/server";
import { clearOrganiserCookie } from "@/lib/auth";

export async function POST() {
  await clearOrganiserCookie();
  return NextResponse.json({ ok: true });
}
