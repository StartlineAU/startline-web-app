import ExcelJS from "exceljs";
import {
  RESULTS_TEMPLATE_HEADERS,
  resultsTemplateValues,
  type ResultsTemplateRow,
} from "@/lib/results-template";

/** Flat workbook: one header row, one athlete per row, no merged wave sections. */
export async function buildResultsTemplateXlsx(rows: ResultsTemplateRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Startline";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Results", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { width: 38 },
    { width: 24 },
    { width: 9 },
    { width: 18 },
    { width: 30 },
    { width: 12 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
  ];

  const header = sheet.addRow([...RESULTS_TEMPLATE_HEADERS]);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E8E8" },
  };

  for (const row of rows) {
    sheet.addRow(resultsTemplateValues(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
