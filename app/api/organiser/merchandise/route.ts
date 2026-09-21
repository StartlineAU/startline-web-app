import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import {
  MAX_PROFILE_MERCHANDISE,
  sanitizeMerchandiseInput,
  sanitizeMerchandiseItem,
} from "@/lib/merchandise";
import { merchandiseForOrganiser } from "@/lib/merchandise-catalogue";
import { z } from "zod";

// The public merchandise on an organiser's profile (#338). Editable by any
// member, OWNER or MANAGER, the same as the rest of the public profile.

const putSchema = z.object({ merchandise: z.unknown().optional() });
const postSchema = z.object({ item: z.unknown() });

// GET: the active organiser's profile merchandise.
export async function GET() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;

  return NextResponse.json({ merchandise: await merchandiseForOrganiser(auth.session.sub) });
}

/**
 * PUT: replace the profile list. Body: { merchandise: MerchandiseInput[] }.
 *
 * Reconciles by id in one transaction. Deleting an item is always safe: an
 * event's copy is its own EventAddOn row and only loses its provenance link
 * (onDelete: SetNull), so nothing an athlete bought is touched.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const organiserId = auth.session.sub;

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const sanitized = sanitizeMerchandiseInput(parsed.data.merchandise ?? []);
  if (!Array.isArray(sanitized)) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.organiserMerchandise.findMany({
      where: { organiserId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((m) => m.id));
    const keptIds = new Set(
      sanitized.map((m) => m.id).filter((id): id is string => !!id && existingIds.has(id)),
    );

    await tx.organiserMerchandise.deleteMany({
      where: { organiserId, id: { notIn: [...keptIds] } },
    });

    for (let i = 0; i < sanitized.length; i++) {
      const { id, ...data } = sanitized[i];
      // An id that is not this organiser's is a create, never a cross-organiser write.
      if (id && keptIds.has(id)) {
        await tx.organiserMerchandise.update({ where: { id }, data: { ...data, sortOrder: i } });
      } else {
        await tx.organiserMerchandise.create({ data: { ...data, organiserId, sortOrder: i } });
      }
    }
  });

  return NextResponse.json({ merchandise: await merchandiseForOrganiser(organiserId) });
}

/**
 * POST: add one item to the end of the profile list. Body: { item }.
 *
 * Used by the event add-on editor's "also show on my profile" option, which
 * publishes a copy of an event's product without the editor having to load
 * and resend the whole profile list.
 */
export async function POST(req: NextRequest) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const organiserId = auth.session.sub;

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const item = sanitizeMerchandiseItem(parsed.data.item);
  if ("error" in item) return NextResponse.json({ error: item.error }, { status: 400 });

  const existing = await prisma.organiserMerchandise.findMany({
    where: { organiserId },
    select: { name: true, sortOrder: true },
  });
  if (existing.length >= MAX_PROFILE_MERCHANDISE) {
    return NextResponse.json(
      { error: `Your profile can show at most ${MAX_PROFILE_MERCHANDISE} items.` },
      { status: 409 },
    );
  }
  if (existing.some((m) => m.name.toLowerCase() === item.name.toLowerCase())) {
    return NextResponse.json(
      { error: `Your profile already has an item called "${item.name}". Rename one of them first.` },
      { status: 409 },
    );
  }

  const created = await prisma.organiserMerchandise.create({
    data: {
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      imageUrl: item.imageUrl,
      optionLabel: item.optionLabel,
      options: item.options,
      organiserId,
      sortOrder: existing.reduce((max, m) => Math.max(max, m.sortOrder + 1), 0),
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
