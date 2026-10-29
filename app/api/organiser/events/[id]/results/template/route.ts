import { NextRequest, NextResponse } from "next/server";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { buildResultsTemplateCsv, type ResultsTemplateRow } from "@/lib/results-template";
import { buildResultsTemplateXlsx } from "@/lib/results-template-xlsx";
import { safeExportFilename } from "@/lib/registration-export";
import { idParams } from "@/lib/schemas";
import { z } from "zod";

const templateQuery = z.object({
  format: z.enum(["csv", "xlsx"]).catch("csv"),
});

function bibSortKey(bib: string | null): number {
  if (!bib) return Number.POSITIVE_INFINITY;
  const value = parseInt(bib, 10);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

/** Download the flat template used by the results importer. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsedParams = idParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { id } = parsedParams.data;
  const { format } = templateQuery.parse(Object.fromEntries(req.nextUrl.searchParams));

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, organiserId: true, title: true },
  });
  if (!event) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (event.organiserId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const registrations = await prisma.registration.findMany({
    where: { eventId: id, status: "CONFIRMED" },
    select: {
      id: true,
      athleteName: true,
      athleteEmail: true,
      bibNumber: true,
      category: true,
      resultTime: true,
      resultPlacement: true,
      resultDistance: true,
      isPersonalBest: true,
      isTopResult: true,
    },
  });

  const rows: ResultsTemplateRow[] = registrations
    .sort((a, b) => {
      const bibDiff = bibSortKey(a.bibNumber) - bibSortKey(b.bibNumber);
      if (bibDiff !== 0) return bibDiff;
      return a.athleteName.localeCompare(b.athleteName);
    })
    .map((registration) => ({
      registrationId: registration.id,
      name: registration.athleteName,
      bib: registration.bibNumber ?? "",
      category: registration.category ?? "",
      email: registration.athleteEmail,
      time: registration.resultTime ?? "",
      placement: registration.resultPlacement ?? "",
      distance: registration.resultDistance ?? "",
      isPersonalBest: registration.isPersonalBest,
      isTopResult: registration.isTopResult,
    }));

  const filename = `${safeExportFilename(event.title)}-results-template.${format}`;

  if (format === "xlsx") {
    const xlsx = await buildResultsTemplateXlsx(rows);
    return new NextResponse(new Uint8Array(xlsx), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return new NextResponse(buildResultsTemplateCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
