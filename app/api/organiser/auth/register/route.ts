import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.organiser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const verifyToken = crypto.randomBytes(32).toString("hex");
  const hashed      = await hashPassword(password);

  await prisma.organiser.create({
    data: {
      email,
      password:    hashed,
      verifyToken,
      status:      "PENDING_EMAIL",
      emailVerified: false,
    },
  });

  await sendVerificationEmail(email, verifyToken);

  return NextResponse.json({ ok: true });
}
