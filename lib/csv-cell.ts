/**
 * One CSV cell, quoted when it needs to be and made safe to open in a
 * spreadsheet.
 *
 * Exports carry text athletes typed themselves (names, medical notes), and
 * Excel, Numbers and Google Sheets run a cell that starts with =, +, -, @ or a
 * tab/carriage return as a formula, and several of them trim leading whitespace
 * first. One such name could send the rest of the sheet to another site the
 * moment an organiser opens the file. Those cells get a leading apostrophe,
 * which spreadsheets show as plain text. A plain number such as -5 or +61 is
 * left alone.
 */
const RAW_FORMULA_START = /^[=+\-@\t\r]/;
const FORMULA_START = /^[=+\-@]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;
// What a spreadsheet drops before deciding the cell is a formula.
const LEADING_WS = /^[\t\n\r\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;

export function escapeCsvCell(value: string): string {
  let cell = value;
  const substantive = cell.replace(LEADING_WS, "");
  const formula = RAW_FORMULA_START.test(cell) || FORMULA_START.test(substantive);
  if (formula && !PLAIN_NUMBER.test(substantive)) cell = `'${cell}`;
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}
