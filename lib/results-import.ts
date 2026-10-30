import { isValidRaceTime, normaliseRaceTime } from "@/lib/race-results";

/** Values produced by a CSV/TSV parser or `read-excel-file`. */
export type ImportCell = string | number | boolean | Date | null | undefined;

export type ParsedResultRow = {
  /** 1-based row number in the source sheet, for pointing organisers at it. */
  sourceRow: number;
  registrationId?: string;
  email?: string;
  distance?: string;
  time?: string;
  placement?: string;
  isPersonalBest?: boolean;
  isTopResult?: boolean;
  /** Set when the row is usable but needs the organiser to fix a value. */
  error?: string;
};

export type ParsedResultsTable = {
  rows: ParsedResultRow[];
  /** Source header labels, kept for the preview copy. */
  header: string[];
  /** Set when no usable result table could be found. */
  error?: string;
};

export type ImportedResultValues = {
  distance: string;
  time: string;
  placement: string;
  isPersonalBest: boolean;
  isTopResult: boolean;
};

export type SavedResultValues = {
  resultDistance: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
  isPersonalBest: boolean;
  isTopResult: boolean;
};

export type ResultChange = {
  registrationId: string;
  resultDistance?: string | null;
  resultTime?: string | null;
  resultPlacement?: string | null;
  isPersonalBest?: boolean;
  isTopResult?: boolean;
};

/**
 * Build the minimal PATCH row for a reviewed import. Unchanged fields are
 * omitted so a blank cell in the file keeps whatever is already saved. A field
 * the organiser deliberately clears is sent as `null`.
 */
export function buildResultChange(
  registrationId: string,
  saved: SavedResultValues,
  draft: ImportedResultValues,
): ResultChange | null {
  const change: ResultChange = { registrationId };
  const distance = draft.distance.trim();
  const time = draft.time.trim();
  const placement = draft.placement.trim();

  if (distance !== (saved.resultDistance ?? "").trim()) {
    change.resultDistance = distance || null;
  }
  if (time !== (saved.resultTime ?? "").trim()) {
    change.resultTime = time || null;
  }
  if (placement !== (saved.resultPlacement ?? "").trim()) {
    change.resultPlacement = placement || null;
  }
  if (draft.isPersonalBest !== saved.isPersonalBest) {
    change.isPersonalBest = draft.isPersonalBest;
  }
  if (draft.isTopResult !== saved.isTopResult) {
    change.isTopResult = draft.isTopResult;
  }

  return Object.keys(change).length > 1 ? change : null;
}

const ALIASES = {
  registrationId: [
    "registrationid", "registration", "entryid", "entry", "athleteid", "competitorid",
  ],
  email: [
    "email", "emailaddress", "athleteemail", "competitoremail", "runneremail", "rideremail",
  ],
  distance: [
    "distance", "resultdistance", "racedistance", "eventdistance",
  ],
  time: [
    "time", "resulttime", "finishtime", "chiptime", "guntime", "nettime", "elapsedtime",
  ],
  placement: [
    "placement", "resultplacement", "place", "placing", "rank", "ranking", "position",
    "overallplace", "overallposition", "overallrank",
  ],
  isPersonalBest: [
    "personalbest", "ispersonalbest", "pb",
  ],
  isTopResult: [
    "topresult", "istopresult", "topfinish", "top",
  ],
} as const;

type ResultField = keyof typeof ALIASES;

function normaliseHeader(value: ImportCell): string {
  return cellText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function cellText(value: ImportCell): string {
  if (value == null) return "";
  if (value instanceof Date) return formatDateOnly(value);
  return String(value).trim();
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Excel stores times as a fraction of a day; read-excel-file may return a Date. */
function timeFromCell(value: ImportCell): string | undefined {
  if (value == null || value === "") return undefined;

  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    // read-excel-file turns a formatted time into a Date anchored at the Excel
    // epoch. Subtracting that epoch keeps hours past 24 intact for ultras.
    const epoch = year <= 1900
      ? Date.UTC(1899, 11, 30)
      : year <= 1904
        ? Date.UTC(1904, 0, 1)
        : null;
    const seconds = epoch === null
      ? value.getUTCHours() * 3600 + value.getUTCMinutes() * 60 + value.getUTCSeconds()
      : Math.round((value.getTime() - epoch) / 1000);
    return seconds > 0 ? formatDuration(seconds, epoch === null ? value.getUTCMilliseconds() : 0) : undefined;
  }

  if (typeof value === "number" && value > 0 && value < 3) {
    // Up to 72 hours covers ultra events while not turning an ambiguous bare
    // figure such as "41" into a time.
    const totalMilliseconds = Math.round(value * 86_400_000);
    return formatDuration(
      Math.floor(totalMilliseconds / 1000),
      totalMilliseconds % 1000,
    );
  }

  const text = cellText(value);
  return text || undefined;
}

function formatDuration(seconds: number, milliseconds = 0): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const fraction = milliseconds > 0
    ? "." + String(milliseconds).padStart(3, "0").replace(/0+$/, "")
    : "";

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${fraction}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}${fraction}`;
}

function booleanFromCell(value: ImportCell): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value == null) return undefined;

  const text = cellText(value).toLowerCase();
  if (!text) return undefined;
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return undefined;
}

function valueForField(field: ResultField, fieldIndex: number, cells: ImportCell[]): string | undefined {
  if (fieldIndex === -1) return undefined;
  const value = cells[fieldIndex];
  if (field === "time") return timeFromCell(value);
  return cellText(value) || undefined;
}

function rowScore(cells: ImportCell[]): number {
  const headers = new Set(cells.map(normaliseHeader).filter(Boolean));
  let score = 0;
  for (const aliases of Object.values(ALIASES)) {
    if (aliases.some((alias) => headers.has(alias))) score += 1;
  }
  const hasMatch = ALIASES.email.some((alias) => headers.has(alias)) ||
    ALIASES.registrationId.some((alias) => headers.has(alias));
  return hasMatch ? score : 0;
}

function findHeaderRow(rows: ImportCell[][]): number {
  let bestIndex = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i += 1) {
    const score = rowScore(rows[i]);
    if (score > bestScore) {
      bestIndex = i;
      bestScore = score;
    }
  }
  return bestIndex;
}

/**
 * Turn a raw sheet/table into result rows. The header may not be the first row:
 * Startline's registration workbook puts a merged wave heading above each group,
 * and timing-system exports often have a title block.
 */
export function parseResultsTable(rows: ImportCell[][]): ParsedResultsTable {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex === -1) {
    return {
      rows: [],
      header: [],
      error: "No athlete email or registration ID column was found. Add a header row with email and result columns.",
    };
  }

  const rawHeader = rows[headerIndex];
  const header = rawHeader.map(cellText);
  const indexes = Object.fromEntries(
    (Object.keys(ALIASES) as ResultField[]).map((field) => {
      const index = rawHeader.findIndex((cell) =>
        (ALIASES[field] as readonly string[]).includes(normaliseHeader(cell)),
      );
      return [field, index];
    }),
  ) as Record<ResultField, number>;

  const hasResultColumn = indexes.time !== -1 ||
    indexes.placement !== -1 ||
    indexes.distance !== -1 ||
    indexes.isPersonalBest !== -1 ||
    indexes.isTopResult !== -1;
  if (!hasResultColumn) {
    return {
      rows: [],
      header,
      error: "Add at least one result column: time, placement, distance, personal best, or top result.",
    };
  }

  const parsed: ParsedResultRow[] = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i];
    if (!cells.some((cell) => cellText(cell).length > 0)) continue;

    const registrationId = valueForField("registrationId", indexes.registrationId, cells);
    const email = valueForField("email", indexes.email, cells);
    // A grouped section heading such as "WAVE A" has neither of the match keys.
    if (!registrationId && !email) continue;

    const distance = valueForField("distance", indexes.distance, cells);
    const rawTime = valueForField("time", indexes.time, cells);
    const placement = valueForField("placement", indexes.placement, cells);
    const isPersonalBest = indexes.isPersonalBest !== -1
      ? booleanFromCell(cells[indexes.isPersonalBest])
      : undefined;
    const isTopResult = indexes.isTopResult !== -1
      ? booleanFromCell(cells[indexes.isTopResult])
      : undefined;

    const hasResult = Boolean(distance || rawTime || placement) ||
      isPersonalBest !== undefined ||
      isTopResult !== undefined;
    if (!hasResult) continue;

    let time = rawTime;
    let error: string | undefined;
    if (time && !isValidRaceTime(time)) {
      error = `Time "${time}" is not readable. Use 41:05 or 1:08:22.`;
    } else if (time) {
      time = normaliseRaceTime(time) ?? time;
    }

    parsed.push({
      sourceRow: i + 1,
      registrationId,
      email: email?.toLowerCase(),
      distance,
      time,
      placement,
      isPersonalBest,
      isTopResult,
      error,
    });
  }

  if (parsed.length === 0) {
    return { rows: [], header, error: "No result rows with an athlete email or registration ID were found." };
  }

  return { rows: parsed, header };
}
