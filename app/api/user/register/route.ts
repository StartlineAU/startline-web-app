import { NextRequest, NextResponse } from "next/server";
import { getServerSession, getUserSub } from "@/lib/auth0";
import { getAdminClient } from "@/lib/supabase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sub = getUserSub(session);
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("event_registrations")
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
  const { event_id, event_title } = await request.json();
  if (!event_id) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: existing } = await supabase
    .from("event_registrations")
    .select("id")
    .eq("auth0_sub", sub)
    .eq("event_id", event_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Already registered" }, { status: 409 });
  }

  const { error } = await supabase
    .from("event_registrations")
    .insert({ auth0_sub: sub, event_id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const email = session.user.email as string;
  if (email) {
    try {
      await resend.emails.send({
        from: "StartLine <events@startline.com.au>",
        to: email,
        subject: `You're registered: ${event_title ?? "Event"}`,
        html: `
          <!DOCTYPE html>
          <html>
            <body style="margin:0;padding:0;background:#141414;font-family:'Inter',system-ui,sans-serif;color:#F5F7FA;">
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 24px;">
                <tr><td align="center">
                  <table width="100%" style="max-width:560px;">
                    <tr><td style="padding-bottom:40px;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:#B3E153;letter-spacing:-0.5px;">STARTLINE</p>
                    </td></tr>
                    <tr><td>
                      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#F5F7FA;">You're registered.</h1>
                      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#8A8F98;">
                        You've registered your interest in <strong style="color:#F5F7FA;">${event_title ?? "an event"}</strong>.
                        We'll keep you updated with any announcements.
                      </p>
                      <hr style="border:none;border-top:1px solid #2A2A2A;margin:0 0 32px;" />
                      <p style="margin:0;font-size:13px;color:#6E737B;">
                        You're receiving this because you registered at startline.com.au
                      </p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error("Registration email error:", emailError);
    }
  }

  return NextResponse.json({ registered: true });
}
