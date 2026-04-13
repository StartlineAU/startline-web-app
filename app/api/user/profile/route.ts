import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession, getUserSub, getRole } from "@/lib/auth0";
import { getAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sub = getUserSub(session);
  const supabase = getAdminClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth0_sub", sub)
    .single();

  if (!data) {
    const jar = await cookies();
    const signupRoleCookie = jar.get("sl_signup_role");
    const role: string =
      signupRoleCookie?.value === "organiser" ? "organiser" : getRole(session);

    const { data: created, error } = await supabase
      .from("profiles")
      .upsert({
        auth0_sub: sub,
        role,
        full_name: (session.user.name as string) ?? "",
        email: (session.user.email as string) ?? "",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json(created);
    response.cookies.set("sl_signup_role", "", { maxAge: 0, path: "/" });
    return response;
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sub = getUserSub(session);
  const body = await request.json();
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      auth0_sub: sub,
      full_name: body.full_name ?? "",
      email: (session.user.email as string) ?? "",
      role: getRole(session),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
