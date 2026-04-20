import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const { error: dbError } = await supabase
    .from("waitlist_subscribers")
    .insert({ email });

  if (dbError) {
    if (dbError.code === "23505") {
      return NextResponse.json({ error: "You're already on the waitlist!" }, { status: 409 });
    }
    console.error("DB error:", dbError);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json({ success: true });
  }

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "StartLine <waitlist@startline.com.au>",
      to: email,
      subject: "You're on the StartLine waitlist!",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;background:#141414;font-family:'Inter',system-ui,sans-serif;color:#F5F7FA;">
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 24px;">
              <tr>
                <td align="center">
                  <table width="100%" style="max-width:560px;">
                    <tr>
                      <td style="padding-bottom:40px;">
                        <p style="margin:0;font-size:28px;font-weight:700;color:#B3E153;letter-spacing:-0.5px;">STARTLINE</p>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#F5F7FA;">You're on the list.</h1>
                        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#8A8F98;">
                          Thanks for joining the StartLine waitlist. We're building the best way to discover HYROX, CrossFit, running and hybrid fitness events across Australia.
                        </p>
                        <p style="margin:0 0 40px;font-size:16px;line-height:1.6;color:#8A8F98;">
                          We'll let you know the moment we launch. In the meantime, get ready to find your next start line.
                        </p>
                        <hr style="border:none;border-top:1px solid #2A2A2A;margin:0 0 32px;" />
                        <p style="margin:0;font-size:13px;color:#6E737B;">
                          You're receiving this because you signed up at startline.com.au
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });
  } catch (emailError) {
    console.error("Email error:", emailError);
    // Don't fail the request — email is best-effort
  }

  return NextResponse.json({ success: true });
}
