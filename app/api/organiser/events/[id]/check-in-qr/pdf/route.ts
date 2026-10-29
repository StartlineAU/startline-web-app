import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import {
  buildCheckInQr,
  checkInUrl,
  ensureCheckInCode,
} from "@/lib/check-in-qr";
import {
  buildCheckInQrPdf,
  checkInQrPdfFilename,
} from "@/lib/check-in-qr-pdf";
import prisma from "@/lib/prisma";
import { idParams } from "@/lib/schemas";

/** Download a print-ready A4 check-in poster for an event. */
export async function GET(
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
    select: {
      id: true,
      checkInCode: true,
      organiserId: true,
      title: true,
      eventDate: true,
      startTime: true,
      endTime: true,
      venue: true,
      city: true,
      state: true,
      organiser: { select: { orgName: true } },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const checkInCode = await ensureCheckInCode(event);
  const qrDataUrl = await buildCheckInQr(checkInUrl(id, checkInCode), 1024);
  const pdf = await buildCheckInQrPdf({
    eventTitle: event.title,
    organiserName: event.organiser.orgName ?? "Startline",
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    venue: event.venue,
    city: event.city,
    state: event.state,
    qrDataUrl,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${checkInQrPdfFilename(event.title)}"`,
    },
  });
}
