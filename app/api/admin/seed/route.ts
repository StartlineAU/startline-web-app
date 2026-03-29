import { NextResponse } from "next/server";
import { supabase, eventToRow } from "@/lib/supabase";
import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = eventsData.events as FitnessEvent[];
  const rows = events.map(eventToRow);

  const { data, error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    seeded: data?.length ?? 0,
    message: `Successfully seeded ${data?.length ?? 0} events into Supabase.`,
  });
}
