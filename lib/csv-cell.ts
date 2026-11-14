/**
 * One CSV cell, quoted when it needs to be and made safe to open in a
 * spreadsheet.
 *
 * Exports carry text athletes typed themselves (names, medical notes), and
 * Excel, Numbers and Google Sheets run a cell that starts with =, +, -, @ or a
 * tab/carriage return as a formula. One such name could send the rest of the
 * sheet to another site the moment an organiser opens the file. Those cells
 * get a leading apostrophe, which spreadsheets show as plain text. A plain
 * number such as -5 or +61 is left alone.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

export function escapeCsvCell(value: string): string {
  let cell = value;
  if (FORMULA_START.test(cell) && !PLAIN_NUMBER.test(cell)) cell = `'${cell}`;
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}
