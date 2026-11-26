import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { removeRegistration, RemovalError } from "@/lib/remove-registration";
import { REMOVAL_NOTE_MAX, REMOVAL_REASONS } from "@/lib/removal-reasons";
import { replacementSchema } from "@/lib/team-swap";

const paramsSchema = z.object({
  id: z.string().min(1).max(255),
  registrationId: z.string().min(1).max(255),
});

const bodySchema = z.object({
  reason: z.enum(REMOVAL_REASONS),
  note: z.string().max(REMOVAL_NOTE_MAX).optional(),
  shareNote: z.boolean().optional(),
  refund: z.enum(["FULL", "NONE"]).default("FULL"),
  block: z.boolean().optional(),
  // A team member's place handed to this person instead of being emptied.
  replacement: replacementSchema.optional(),
}).strict();

/**
 * POST — remove one athlete from the event (#571). Owners and managers of the
 * organisation running it. See lib/remove-registration.ts for what happens.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; registrationId: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id, registrationId } = parsedParams.data;

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const limited = await rateLimit(req, {
    prefix: "organiser-remove-entry",
    limit: 60,
    windowSeconds: 600,
    identifier: session.sub,
  });
  if (limited) return limited;

  const event = await prisma.event.findUnique({ where: { id }, select: { organiserId: true } });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    const result = await removeRegistration({
      registrationId,
      eventId: id,
      organiserId: session.sub,
      actorEmail: auth.actorEmail ?? session.email,
      ...parsedBody.data,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RemovalError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Remove registration failed:", registrationId, err);
    return NextResponse.json({ error: "Something went wrong removing this athlete. Refresh before trying again." }, { status: 500 });
  }
}
