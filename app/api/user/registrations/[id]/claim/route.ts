import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession } from "@/lib/amplify-server";
import { rateLimit } from "@/lib/rate-limit";
import { idParams } from "@/lib/schemas";
import { claimEntry, unclaimEntry, type ClaimOutcome } from "@/lib/claim-entries";

const claimBody = z.object({ token: z.string().max(512).optional() }).strict();

const CLAIM_REPLIES: Record<ClaimOutcome, { status: number; body: Record<string, unknown> }> = {
  "claimed":       { status: 200, body: { onProfile: true } },
  "already-yours": { status: 200, body: { onProfile: true } },
  "taken":         { status: 409, body: { error: "This race is already on another athlete's profile." } },
  "duplicate":     { status: 409, body: { error: "You already have a race for this event on your profile." } },
  "not-allowed":   { status: 403, body: { error: "This link can't add that race to your profile." } },
  "not-found":     { status: 404, body: { error: "Registration not found." } },
};

/**
 * POST — add an entry to the signed-in athlete's race history (#598).
 * Body `{ token }` when it comes from the confirmation email's link; without
 * one, only an entry Activity offers by email can be added.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const limited = await rateLimit(req, { prefix: "entry-claim", limit: 20, windowSeconds: 3600, identifier: session.sub });
  if (limited) return limited;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json(CLAIM_REPLIES["not-found"].body, { status: 404 });

  const parsedBody = claimBody.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const outcome = await claimEntry({
      registrationId: parsedParams.data.id,
      user: { id: session.sub, email: session.email },
      token: parsedBody.data.token,
    });
    const reply = CLAIM_REPLIES[outcome];
    return NextResponse.json(reply.body, { status: reply.status });
  } catch (err) {
    console.error("Adding a race to a profile failed:", err);
    return NextResponse.json({ error: "Couldn't add this race. Try again." }, { status: 500 });
  }
}

/** DELETE — take an entry off the signed-in athlete's race history. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const limited = await rateLimit(req, { prefix: "entry-claim", limit: 20, windowSeconds: 3600, identifier: session.sub });
  if (limited) return limited;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json(CLAIM_REPLIES["not-found"].body, { status: 404 });

  const outcome = await unclaimEntry({ registrationId: parsedParams.data.id, userId: session.sub });
  if (outcome === "not-found") return NextResponse.json(CLAIM_REPLIES["not-found"].body, { status: 404 });
  return NextResponse.json({ onProfile: false });
}
