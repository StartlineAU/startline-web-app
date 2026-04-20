import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyPassword, signToken, setOrganiserCookie } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const organiser = await prisma.organiser.findUnique({ where: { email } });
  if (!organiser || !(await verifyPassword(password, organiser.password))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const jwt = await signToken({
    sub:    organiser.id,
    role:   "organiser",
    email:  organiser.email,
    status: organiser.status,
  });
  await setOrganiserCookie(jwt);

  // Tell the client where to redirect based on account status
  const redirectMap: Record<string, string> = {
    PENDING_EMAIL:   "/organiser/verify-email",
    PENDING_PROFILE: "/organiser/onboarding",
    PENDING_REVIEW:  "/organiser/pending",
    REJECTED:        "/organiser/pending",
    APPROVED:        "/organiser/dashboard",
    SUSPENDED:       "/organiser/pending",
  };

  return NextResponse.json({ redirect: redirectMap[organiser.status] ?? "/organiser" });
}
