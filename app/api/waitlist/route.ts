import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { WaitlistConfirmationEmail } from "@/emails/waitlist-confirmation";

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
    const html = await render(WaitlistConfirmationEmail());
    const result = await getResend().emails.send({
      from:    "Startline <waitlist@startlineau.com>",
      to:      email,
      subject: "You're on the Startline waitlist",
      html,
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
