import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import readXlsxFile from "read-excel-file/node";
import { parseResultsTable, type ImportCell } from "@/lib/results-import";

describe("xlsx results import", () => {
  it("reads a flat sheet and skips merged wave headings", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Results");
    sheet.addRow(["WAVE A"]);
    sheet.mergeCells(1, 1, 1, 3);
    sheet.addRow(["email", "time", "placement"]);
    sheet.addRow(["alex@example.com", "41:05", "8th"]);
    sheet.addRow(["bree@example.com", "42:10", "3rd"]);

    const buffer = await workbook.xlsx.writeBuffer();
    const sheets = await readXlsxFile(Buffer.from(buffer));
    const table = parseResultsTable(sheets[0].data as ImportCell[][]);

    expect(table.error).toBeUndefined();
    expect(table.rows.map((row) => row.email)).toEqual([
      "alex@example.com",
      "bree@example.com",
    ]);
    expect(table.rows.map((row) => row.time)).toEqual(["41:05", "42:10"]);
  });

  it("converts a formatted Excel duration to a race time", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Results");
    sheet.addRow(["email", "time"]);
    const row = sheet.addRow(["alex@example.com"]);
    row.getCell(2).value = 2465 / 86_400;
    row.getCell(2).numFmt = "h:mm:ss";

    const buffer = await workbook.xlsx.writeBuffer();
    const sheets = await readXlsxFile(Buffer.from(buffer));
    const table = parseResultsTable(sheets[0].data as ImportCell[][]);

    expect(table.rows[0].time).toBe("41:05");
  });
});
