import { NextResponse } from "next/server";
import { mergeCatalogWithDbRows } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
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

    if (error || !data?.length) {
      return NextResponse.json(eventsData.events);
    }

    return NextResponse.json(mergeCatalogWithDbRows(data as Record<string, unknown>[]));
  } catch {
    // Supabase unavailable — serve the static catalog as fallback
    return NextResponse.json(eventsData.events as FitnessEvent[]);
  }
}
