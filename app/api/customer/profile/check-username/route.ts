import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerSession } from "@/lib/amplify-server";
import { validateUsername } from "@/lib/username-validation";

export async function GET(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const username = req.nextUrl.searchParams.get("username")?.trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ available: false, error: "Username is required." });
  }

  const validation = validateUsername(username);
  if (!validation.valid) {
    return NextResponse.json({ available: false, error: validation.reason });
  }

  const existing = await prisma.customer.findUnique({
    where: { username },
    select: { id: true },
  });

  const available = !existing || existing.id === session.sub;

  return NextResponse.json({ available, error: available ? null : "This username is already taken." });
}
