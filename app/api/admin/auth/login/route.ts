import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyPassword, signToken, setAdminCookie } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !(await verifyPassword(password, admin.password))) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const jwt = await signToken(
    { sub: admin.id, role: "admin", email: admin.email, status: "admin" },
    "8h"
  );
  await setAdminCookie(jwt);

  return NextResponse.json({ ok: true });
}
