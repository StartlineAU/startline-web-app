import { NextResponse } from "next/server";
import { supabase, rowToEvent, eventToRow } from "@/lib/supabase";
import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json(eventsData.events);
    }
    return NextResponse.json(data.map(rowToEvent));
  } catch {
    return NextResponse.json(eventsData.events);
  }
}

function checkAuth(request: Request): boolean {
  const auth = request.headers.get("Authorization");
  return auth === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<FitnessEvent>;
  const id = body.id ?? crypto.randomUUID();
  const row = eventToRow({ ...body, id });

  const { data, error } = await supabase
    .from("events")
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rowToEvent(data as Record<string, unknown>), { status: 201 });
}
