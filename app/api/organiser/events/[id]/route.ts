import { NextResponse } from "next/server";
import { getServerSession, getUserSub, getRole } from "@/lib/auth0";
import { getAdminClient } from "@/lib/supabase-admin";
import { rowToEvent, eventToRow } from "@/lib/supabase";
import { FitnessEvent } from "@/types";

async function verifyOwnership(id: string) {
  const session = await getServerSession();
  if (!session) return { error: "Not authenticated", status: 401 } as const;

  const role = getRole(session);
  if (role !== "organiser") return { error: "Forbidden", status: 403 } as const;

  const sub = getUserSub(session);
  const supabase = getAdminClient();

  const { data } = await supabase
    .from("events")
    .select("organiser_sub")
    .eq("id", id)
    .single();

  if (!data) return { error: "Event not found", status: 404 } as const;
  if ((data as Record<string, unknown>).organiser_sub !== sub) {
    return { error: "Not your event", status: 403 } as const;
  }

  return { sub, supabase } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...rowToEvent(data as Record<string, unknown>),
    status: (data as Record<string, unknown>).status,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const check = await verifyOwnership(id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await request.json()) as Partial<FitnessEvent>;
  const row = eventToRow(body);

  const { data, error } = await check.supabase
    .from("events")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rowToEvent(data as Record<string, unknown>));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const check = await verifyOwnership(id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { error } = await check.supabase.from("events").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
