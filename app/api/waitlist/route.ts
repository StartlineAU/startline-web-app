import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { Resend } from "resend";
import prisma from "@/lib/prisma";

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

  try {
    await prisma.waitlistSubscriber.create({ data: { email } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "You're already on the waitlist!" }, { status: 409 });
    }
    console.error("DB error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  try {
    const result = await getResend().emails.send({
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
                          src="https://www.startlineau.com/images/logo-email.png"
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
                          Thanks for joining the StartLine waitlist. We're building the best way to discover fitness racing, CrossFit, running and hybrid fitness events across Australia.
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
    if (result.error) {
      console.error("Resend error:", result.error);
    } else {
      console.log("Email sent successfully, id:", result.data?.id);
    }
  } catch (emailError) {
    console.error("Email send failed:", emailError);
  }

  return NextResponse.json({ success: true });
}
