import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findCognitoUserByEmail } from "@/lib/athlete-accounts";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().max(255) });

// POST /api/user/signin-username
// Amplify's password flow needs the Cognito username. For native users that is
// the email, but a Google or Apple profile keeps its provider-generated
// username even after a password is added. The sign-in modal asks here so it
// can pass the right identifier without showing it to the person.
export async function POST(req: NextRequest) {
  const blocked = await rateLimit(req, { prefix: "signin-username", limit: 10, windowSeconds: 60 });
  if (blocked) return blocked;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  try {
    const user = await findCognitoUserByEmail(email);
    if (!user) {
      return NextResponse.json({ exists: false }, { status: 404 });
    }
    return NextResponse.json({ username: user.username });
  } catch (err) {
    console.error("Could not resolve a sign-in username:", err);
    return NextResponse.json({ error: "Failed to look up account." }, { status: 503 });
  }
}
