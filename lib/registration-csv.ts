/** CSV helpers for organiser results import. Export lives in registration-export.ts. */

/**
 * Split delimited text into rows and cells.
 *
 * Spreadsheet copy/paste is tab-separated, while exported files are usually
 * comma-separated, so the delimiter is inferred from the first non-empty line.
 * Quoted CSV fields are handled too, because a results file from another system
 * may put a comma inside a name or note.
 */
export function parseDelimitedRows(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const delimiter = tabs > commas ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim().length > 0));
}

/** Legacy table shape used by the bulk-results paste flow. */
export function parseCsvTable(text: string): { header: string[]; rows: string[][] } {
  const table = parseDelimitedRows(text);
  if (table.length === 0) return { header: [], rows: [] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  return { header, rows: table.slice(1) };
}
