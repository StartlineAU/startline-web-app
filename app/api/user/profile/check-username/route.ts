import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserSession } from "@/lib/amplify-server";
import { rateLimit } from "@/lib/rate-limit";
import { validateUsername } from "@/lib/username-validation";
import { z } from "zod";

const usernameQuery = z.object({ username: z.string().min(1).max(50) });

export async function GET(req: NextRequest) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  const limited = await rateLimit(req, { prefix: "check-username", limit: 60, windowSeconds: 60, identifier: session.sub });
  if (limited) return limited;

  const parsed = usernameQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ available: false, error: "Username is required." });
  }

  const username = parsed.data.username.toLowerCase();

  const validation = validateUsername(username);
  if (!validation.valid) {
    return NextResponse.json({ available: false, error: validation.reason });
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  const available = !existingUser || existingUser.id === session.sub;

  return NextResponse.json({ available, error: available ? null : "This username is already taken." });
}
