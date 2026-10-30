import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import { buildCheckInQr, checkInUrl, ensureCheckInCode } from "@/lib/check-in-qr";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = idParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsed.data;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, checkInCode: true, organiserId: true },
  });
  if (!event)                            return NextResponse.json({ error: "Not found." },  { status: 404 });
  if (event.organiserId !== session.sub) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // The check-in code is generated once and persisted so every tap shows the
  // same QR. crypto-random, never derived from the event id/title.
  const checkInCode = await ensureCheckInCode(event);
  const url = checkInUrl(id, checkInCode);
  // 1024px so the same image can be composited into the downloadable PNG
  // without visibly upscaling it.
  const qrDataUrl = await buildCheckInQr(url, 1024);

  return NextResponse.json({ url, qrDataUrl });
}
