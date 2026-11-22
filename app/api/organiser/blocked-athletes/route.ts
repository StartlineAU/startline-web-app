import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeBlockEmail, upsertOrganiserBlock } from "@/lib/organiser-blocks";

const addSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  name: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
}).strict();

// GET /api/organiser/blocked-athletes
// The active organisation's block list (#571). Owners and managers can read
// it; only an owner can change it.
export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const blocks = await prisma.organiserBlock.findMany({
      where: { organiserId: session.sub },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        note: true,
        createdByEmail: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });
    return NextResponse.json({
      role: session.role,
      blocks: blocks.map((b) => ({
        id: b.id,
        email: b.email,
        name: b.name ?? b.user?.name ?? null,
        note: b.note,
        createdByEmail: b.createdByEmail,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}

// POST /api/organiser/blocked-athletes
// Body: { email, name?, note? }. Owner only. Adding an address already on the
// list keeps the one entry.
export async function POST(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only an Owner can change the blocked list." }, { status: 403 });
  }

  const limited = await rateLimit(req, {
    prefix: "organiser-block-add",
    limit: 60,
    windowSeconds: 600,
    identifier: session.sub,
  });
  if (limited) return limited;

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  try {
    const block = await upsertOrganiserBlock({
      organiserId: session.sub,
      email: normalizeBlockEmail(parsed.data.email),
      name: parsed.data.name,
      note: parsed.data.note,
      createdByEmail: auth.actorEmail ?? session.email,
    });
    return NextResponse.json({ id: block.id, email: block.email }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
}
