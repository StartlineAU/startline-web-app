import { NextResponse } from "next/server";
import { supabase, rowToEvent } from "@/lib/supabase";

function checkAuth(request: Request): boolean {
  const auth = request.headers.get("Authorization");
  return auth === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "pending")
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []).map((row) => ({
    ...rowToEvent(row as Record<string, unknown>),
    status: (row as Record<string, unknown>).status as string,
    organiser_sub: (row as Record<string, unknown>).organiser_sub as string | null,
  }));

  return NextResponse.json(events);
}
