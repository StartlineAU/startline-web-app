import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { idParams } from "@/lib/schemas";
import { RACE_FEATURE_MODES, RACE_FEATURES_SELECT } from "@/lib/race-features";

const bodySchema = z
  .object({
    waveMode: z.enum(RACE_FEATURE_MODES).optional(),
    bibMode: z.enum(RACE_FEATURE_MODES).optional(),
  })
  .refine((b) => b.waveMode !== undefined || b.bibMode !== undefined, {
    message: "Nothing to change.",
  });

// PATCH — turn start waves or bib numbers on, share them with athletes, or turn
// them off (#566). Turning one off hides it and keeps the data, so turning it
// back on restores every assignment. Owners and managers both pass
// requireOrganiser, like the other race-management writes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const limited = await rateLimit(req, {
    prefix: "race-features",
    limit: 60,
    windowSeconds: 3600,
    identifier: session.sub,
  });
  if (limited) return limited;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, organiserId: true },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Choose waveMode or bibMode: OFF, PRIVATE or SHARED." }, { status: 400 });
  }

  const updated = await prisma.event.update({
    where: { id },
    data: parsedBody.data,
    select: RACE_FEATURES_SELECT,
  });
  return NextResponse.json(updated);
}
