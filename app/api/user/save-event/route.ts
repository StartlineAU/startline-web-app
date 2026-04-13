import { NextRequest, NextResponse } from "next/server";
import { getServerSession, getUserSub } from "@/lib/auth0";
import { getAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sub = getUserSub(session);
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("saved_events")
    .select("event_id")
    .eq("auth0_sub", sub);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data?.map((r) => r.event_id) ?? []);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sub = getUserSub(session);
  const { event_id } = await request.json();
  if (!event_id) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: existing } = await supabase
    .from("saved_events")
    .select("event_id")
    .eq("auth0_sub", sub)
    .eq("event_id", event_id)
    .single();

  if (existing) {
    await supabase
      .from("saved_events")
      .delete()
      .eq("auth0_sub", sub)
      .eq("event_id", event_id);
    return NextResponse.json({ saved: false });
  }

  const { error } = await supabase
    .from("saved_events")
    .insert({ auth0_sub: sub, event_id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
