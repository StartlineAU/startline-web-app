import { parseResultsTable, type ImportCell, type ParsedResultsTable } from "@/lib/results-import";

export type ResultsWorkbookSheet = {
  name: string;
  table: ParsedResultsTable;
};

/**
 * Read every worksheet in an .xlsx file in the browser. The raw file never goes
 * through a route handler, so it is not subject to the platform's multipart size
 * ceiling and medical/contact columns in the workbook do not leave the device.
 */
export async function readResultsWorkbook(file: File): Promise<ResultsWorkbookSheet[]> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  return sheets.map((sheet) => ({
    name: sheet.sheet,
    table: parseResultsTable(sheet.data as ImportCell[][]),
  }));
}
