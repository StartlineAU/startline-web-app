import { NextResponse } from "next/server";
import { getServerSession, getUserSub, getRole } from "@/lib/auth0";
import { getAdminClient } from "@/lib/supabase-admin";
import { eventToRow } from "@/lib/supabase";
import { FitnessEvent } from "@/types";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = getRole(session);
  if (role !== "organiser") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sub = getUserSub(session);
  const body = (await request.json()) as Partial<FitnessEvent>;

  const id = crypto.randomUUID();
  const row = eventToRow({ ...body, id });

  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("events")
    .insert({
      ...row,
      organiser_sub: sub,
      status: "pending",
      organizer: (session.user.name as string) ?? "Organiser",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
