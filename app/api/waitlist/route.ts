import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY environment variable.");
  return new Resend(key);
}

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

  try {
    await getResend().emails.send({
      from: "StartLine <waitlist@startlineau.com>",
      to: email,
      subject: "You're on the StartLine waitlist!",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&display=swap');
            </style>
          </head>
          <body style="margin:0;padding:0;background:#141414;font-family:'Chakra Petch',system-ui,sans-serif;color:#F5F7FA;">
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 24px;">
              <tr>
                <td align="center">
                  <table width="100%" style="max-width:560px;">
                    <tr>
                      <td style="padding-bottom:40px;">
                        <img
                          src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTk0IiBoZWlnaHQ9IjE0OSIgdmlld0JveD0iMCAwIDk5NCAxNDkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+DQo8cGF0aCBkPSJNNDkuNDI5NyA5OC44NTkzSDExOS43NzJMNzAuMzQyMiAxNDguMjg5SDBMNDkuNDI5NyA5OC44NTkzWiIgZmlsbD0iI0IzRTE1MyIvPg0KPHBhdGggZD0iTTE2OS4yMDIgNDkuNDI5N0gyMzkuNTQ0TDE5MC4xMTQgOTguODU5M0gxMTkuNzcyTDE2OS4yMDIgNDkuNDI5N1oiIGZpbGw9IiNCM0UxNTMiLz4NCjxwYXRoIGQ9Ik0xOTAuMTE0IDk4Ljg1OTNIMjYwLjQ1NkwyMTEuMDI3IDE0OC4yODlIMTQwLjY4NEwxOTAuMTE0IDk4Ljg1OTNaIiBmaWxsPSIjQjNFMTUzIi8+DQo8cGF0aCBkPSJNMjg4Ljk3MyAwSDM1OS4zMTZMMzA5Ljg4NiA0OS40Mjk2SDIzOS41NDRMMjg4Ljk3MyAwWiIgZmlsbD0iI0IzRTE1MyIvPg0KPHBhdGggZD0iTTMwOS44ODYgNDkuNDI5N0gzODAuMjI4TDMzMC43OTkgOTguODU5M0gyNjAuNDU2TDMwOS44ODYgNDkuNDI5N1oiIGZpbGw9IiNCM0UxNTMiLz4NCjxwYXRoIGQ9Ik0zMzAuNzk4IDk4Ljg1OTNINDAxLjE0MUwzNTEuNzExIDE0OC4yODlIMjgxLjM2OUwzMzAuNzk4IDk4Ljg1OTNaIiBmaWxsPSIjQjNFMTUzIi8+DQo8cGF0aCBkPSJNNDI5LjY1OCAwSDUwMEw0NTAuNTcgNDkuNDI5NkgzODAuMjI4TDQyOS42NTggMFoiIGZpbGw9IiNCM0UxNTMiLz4NCjxwYXRoIGQ9Ik0xNDguMjg5IDBIMjE4LjYzMUwxNjkuMjAyIDQ5LjQyOTZIOTguODU5M0wxNDguMjg5IDBaIiBmaWxsPSIjQjNFMTUzIi8+DQo8cGF0aCBkPSJNNTA0LjggOTYuNjMyVjg3LjAzMkg1MTcuNjY0VjkyLjY5Nkw1MjAuODMyIDk1Ljg2NEg1NDAuNzA0TDU0My45NjggOTIuNlY4MS40NjRMNTQwLjggNzguMjk2SDUxNS4zNkw1MDQuOTkyIDY3LjkyOFY1MC4xNjhMNTE1LjM2IDM5LjhINTQ1LjY5Nkw1NTYuMDY0IDUwLjE2OFY1OS44NjRINTQzLjJWNTQuMTA0TDU0MC4wMzIgNTAuOTM2SDUyMS4wMjRMNTE3Ljg1NiA1NC4xMDRWNjMuOTkyTDUyMS4wMjQgNjcuMTZINTQ2LjQ2NEw1NTYuODMyIDc3LjUyOFY5Ni40NEw1NDYuMjcyIDEwN0g1MTUuMTY4TDUwNC44IDk2LjYzMlpNNTgwLjE5MiA1MC44NEg1NjAuMTI4VjM5LjhINjEzLjMxMlY1MC44NEg1OTMuMjQ4VjEwN0g1ODAuMTkyVjUwLjg0Wk02MzEuMTgxIDM5LjhINjQzLjA4NUw2NjcuNjYxIDEwN0g2NTQuNDEzTDY0OC45NDEgOTIuMTJINjI1LjMyNUw2MTkuODUzIDEwN0g2MDYuNjA1TDYzMS4xODEgMzkuOFpNNjQ2LjA2MSA4MS4zNjhMNjM3LjEzMyA1NS44MzJINjM2Ljk0MUw2MjguMzAxIDgxLjM2OEg2NDYuMDYxWk03MjcuMjI4IDg0LjcyOFYxMDdINzE0LjE3MlY4Ny43MDRMNzA4LjQxMiA4MS4yNzJINjg3LjQ4NFYxMDdINjc0LjQyOFYzOS44SDcxNi41NzJMNzI2Ljg0NCA1MC4xNjhWNzAuNTJMNzIwLjMxNiA3Ny4xNDRMNzI3LjIyOCA4NC43MjhaTTY4Ny40ODQgNzAuNTJINzEwLjYyTDcxMy45OCA2Ny4xNlY1NC4xMDRMNzEwLjYyIDUwLjc0NEg2ODcuNDg0VjcwLjUyWk03NTMuMDY3IDUwLjg0SDczMy4wMDNWMzkuOEg3ODYuMTg3VjUwLjg0SDc2Ni4xMjNWMTA3SDc1My4wNjdWNTAuODRaTTc5My44NjUgMzkuOEg4MDYuOTIxVjk1Ljk2SDg0MC41MjFWMTA3SDc5My44NjVWMzkuOFpNODQ4LjE1OCAzOS44SDg2MS4yMTRWMTA3SDg0OC4xNThWMzkuOFpNODc0LjIwOSAzOS44SDg4NS45MjFMOTE1Ljg3MyA4NS40SDkxNi4wNjVWMzkuOEg5MjguNjQxVjEwN0g5MTYuOTI5TDg4Ni45NzcgNjEuNDk2SDg4Ni43ODVWMTA3SDg3NC4yMDlWMzkuOFpNOTQxLjE0NiAzOS44SDk4OS43MjJWNTAuODRIOTU0LjIwMlY2Ny44MzJIOTg2LjkzOFY3OC42OEg5NTQuMjAyVjk1Ljk2SDk4OS43MjJWMTA3SDk0MS4xNDZWMzkuOFoiIGZpbGw9IndoaXRlIi8+DQo8L3N2Zz4NCg=="
                          alt="StartLine"
                          width="300"
                          style="display:block;border:0;height:auto;"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#F5F7FA;font-family:'Chakra Petch',system-ui,sans-serif;">You're on the list.</h1>
                        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#8A8F98;font-family:'Chakra Petch',system-ui,sans-serif;">
                          Thanks for joining the StartLine waitlist. We're building the best way to discover HYROX, CrossFit, running and hybrid fitness events across Australia.
                        </p>
                        <p style="margin:0 0 40px;font-size:16px;line-height:1.6;color:#8A8F98;font-family:'Chakra Petch',system-ui,sans-serif;">
                          We'll let you know the moment we launch.
                          <br /><br />
                          In the meantime, get ready to find your next start line.
                        </p>
                        <hr style="border:none;border-top:1px solid #2A2A2A;margin:0 0 32px;" />
                        <p style="margin:0;font-size:13px;color:#6E737B;font-family:'Chakra Petch',system-ui,sans-serif;">
                          You're receiving this because you signed up at startlineau.com
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
