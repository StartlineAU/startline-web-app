import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildRegistrationsXlsx } from "@/lib/registration-export-xlsx";

describe("buildRegistrationsXlsx", () => {
  it("builds a workbook for a title with characters Excel forbids in sheet names", async () => {
    const buffer = await buildRegistrationsXlsx({
      eventTitle: "'Run: 5K/10K [Day 1]? * \\ Final'",
      rows: [],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const name = workbook.worksheets[0].name;
    expect(name).not.toMatch(/[:\\/?*[\]]/);
    expect(name.startsWith("'")).toBe(false);
    expect(name.length).toBeLessThanOrEqual(31);
  });

  it("falls back to a default name when nothing usable is left", async () => {
    const buffer = await buildRegistrationsXlsx({ eventTitle: "::://", rows: [] });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(workbook.worksheets[0].name).toBe("Registrations");
  });
});
