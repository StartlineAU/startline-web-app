import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { signToken, setOrganiserCookie } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/organiser?error=invalid_token", req.url));
  }

  const organiser = await prisma.organiser.findFirst({ where: { verifyToken: token } });
  if (!organiser) {
    return NextResponse.redirect(new URL("/organiser?error=invalid_token", req.url));
  }

  await prisma.organiser.update({
    where: { id: organiser.id },
    data:  { emailVerified: true, verifyToken: null, status: "PENDING_PROFILE" },
  });

  // Issue a session token so they're logged in and land on onboarding
  const jwt = await signToken({
    sub:    organiser.id,
    role:   "organiser",
    email:  organiser.email,
    status: "PENDING_PROFILE",
  });
  await setOrganiserCookie(jwt);

  return NextResponse.redirect(new URL("/organiser/onboarding", req.url));
}
