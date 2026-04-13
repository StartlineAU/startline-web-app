import { NextResponse } from "next/server";
import { getServerSession, getUserSub, getRole } from "@/lib/auth0";
import { getAdminClient } from "@/lib/supabase-admin";
import { rowToEvent } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = getRole(session);
  if (role !== "organiser") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sub = getUserSub(session);
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("organiser_sub", sub)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []).map((row) => ({
    ...rowToEvent(row as Record<string, unknown>),
    status: (row as Record<string, unknown>).status as string,
  }));

  return NextResponse.json(events);
}
