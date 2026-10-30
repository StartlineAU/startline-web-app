/** Flat results template shared by the organiser download and import flow. */

export const RESULTS_TEMPLATE_HEADERS = [
  "registrationId",
  "name",
  "bib",
  "category",
  "email",
  "time",
  "placement",
  "distance",
  "personalBest",
  "topResult",
] as const;

export type ResultsTemplateRow = {
  registrationId: string;
  name: string;
  bib: string;
  category: string;
  email: string;
  time: string;
  placement: string;
  distance: string;
  isPersonalBest: boolean;
  isTopResult: boolean;
};

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function resultsTemplateValues(row: ResultsTemplateRow): string[] {
  return [
    row.registrationId,
    row.name,
    row.bib,
    row.category,
    row.email,
    row.time,
    row.placement,
    row.distance,
    row.isPersonalBest ? "TRUE" : "FALSE",
    row.isTopResult ? "TRUE" : "FALSE",
  ];
}

export function buildResultsTemplateCsv(rows: ResultsTemplateRow[]): string {
  const lines = [
    RESULTS_TEMPLATE_HEADERS.join(","),
    ...rows.map((row) => resultsTemplateValues(row).map(escapeCsvCell).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}
