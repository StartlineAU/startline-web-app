import { NextResponse } from "next/server";
import { supabase, rowToEvent, eventToRow, mergeCatalogWithDbRows } from "@/lib/supabase";
import eventsData from "@/data/events.json";
import { FitnessEvent } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .or("status.eq.approved,status.is.null")
      .order("date", { ascending: true });

    const fallback = eventsData.events as FitnessEvent[];

    if (error || !data?.length) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json(mergeCatalogWithDbRows(data as Record<string, unknown>[]));
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
