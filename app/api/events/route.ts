import { NextResponse } from "next/server";
import { getAllEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await getAllEvents();
  return NextResponse.json(events);
}
