"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FormSelect from "@/components/ui/FormSelect";
import { parseDelimitedRows } from "@/lib/registration-csv";
import { isValidRaceTime } from "@/lib/race-results";
import {
  buildResultChange,
  parseResultsTable,
  type ParsedResultRow,
} from "@/lib/results-import";
import { readResultsWorkbook, type ResultsWorkbookSheet } from "@/lib/results-workbook";

export type ImportableRegistration = {
  id: string;
  name: string;
  email: string;
  category: string | null;
  wave: string | null;
  bibNumber: string | null;
  status: "CONFIRMED" | "REFUND_REQUESTED" | "REFUNDED" | "CANCELLED";
  resultDistance: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
  isPersonalBest: boolean;
  isTopResult: boolean;
};

type Draft = {
  distance: string;
  time: string;
  placement: string;
  isPersonalBest: boolean;
  isTopResult: boolean;
};

type PreviewRow = {
  key: string;
  imported: ParsedResultRow;
  registrationId: string;
  draft: Draft;
  matchIssue?: string;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function registrationById(registrations: ImportableRegistration[]) {
  return new Map(registrations.map((registration) => [registration.id, registration]));
}

function registrationsByEmail(registrations: ImportableRegistration[]) {
  const map = new Map<string, ImportableRegistration[]>();
  for (const registration of registrations) {
    const email = registration.email.trim().toLowerCase();
    const list = map.get(email) ?? [];
    list.push(registration);
    map.set(email, list);
  }
  return map;
}

function draftFor(row: ParsedResultRow, registration?: ImportableRegistration): Draft {
  return {
    distance: row.distance ?? registration?.resultDistance ?? "",
    time: row.time ?? registration?.resultTime ?? "",
    placement: row.placement ?? registration?.resultPlacement ?? "",
    isPersonalBest: row.isPersonalBest ?? registration?.isPersonalBest ?? false,
    isTopResult: row.isTopResult ?? registration?.isTopResult ?? false,
  };
}

function initialPreviewRows(
  parsedRows: ParsedResultRow[],
  registrations: ImportableRegistration[],
): PreviewRow[] {
  const byId = registrationById(registrations);
  const byEmail = registrationsByEmail(registrations);

  return parsedRows.map((row, index) => {
    let registration = row.registrationId ? byId.get(row.registrationId) : undefined;
    let matchIssue: string | undefined;

    if (!registration && row.registrationId) {
      matchIssue = `Registration ${row.registrationId} is not in this event.`;
    }

    if (!registration && row.email) {
      const emailMatches = byEmail.get(row.email) ?? [];
      if (emailMatches.length === 1) registration = emailMatches[0];
      else if (emailMatches.length > 1) {
        matchIssue = "That email belongs to more than one entry. Choose the athlete.";
      } else {
        matchIssue = `No athlete found with ${row.email}.`;
      }
    }

    return {
      key: `${row.sourceRow}-${index}`,
      imported: row,
      registrationId: registration?.id ?? "",
      draft: draftFor(row, registration),
      matchIssue,
    };
  });
}

function trimValue(value: string) {
  return value.trim();
}

function draftsEqual(left: Draft, right: Draft) {
  return trimValue(left.distance) === trimValue(right.distance) &&
    trimValue(left.time) === trimValue(right.time) &&
    trimValue(left.placement) === trimValue(right.placement) &&
    left.isPersonalBest === right.isPersonalBest &&
    left.isTopResult === right.isTopResult;
}

function ResultFieldInput({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full min-w-[76px] bg-dark border rounded-md px-2 py-1.5 text-[12px] text-light placeholder:text-placeholder focus:outline-none ${
        invalid ? "border-red-400/70 focus:border-red-300" : "border-dark-lighter focus:border-primary"
      }`}
    />
  );
}

export default function ResultsImportDialog({
  eventId,
  registrations,
  onClose,
  onImported,
}: {
  eventId: string;
  registrations: ImportableRegistration[];
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [sourceError, setSourceError] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [readingFile, setReadingFile] = useState(false);
  const [workbookSheets, setWorkbookSheets] = useState<ResultsWorkbookSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState("");

  const sortedRegistrations = useMemo(
    () => [...registrations].sort((a, b) => {
      const statusDiff = Number(a.status !== "CONFIRMED") - Number(b.status !== "CONFIRMED");
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    }),
    [registrations],
  );

  const byId = useMemo(() => registrationById(registrations), [registrations]);

  function showParsedRows(rows: ParsedResultRow[]) {
    setPreviewRows(initialPreviewRows(rows, registrations));
    setSourceError("");
    setApplyError("");
  }

  function loadSheet(sheet: ResultsWorkbookSheet) {
    setSelectedSheet(sheet.name);
    if (sheet.table.rows.length === 0) {
      setPreviewRows([]);
      setSourceError(sheet.table.error ?? "That sheet has no result rows.");
      return;
    }
    showParsedRows(sheet.table.rows);
  }

  function previewPastedText() {
    const table = parseResultsTable(parseDelimitedRows(pasteText));
    if (table.rows.length === 0) {
      setPreviewRows([]);
      setSourceError(table.error ?? "No result rows were found in the pasted data.");
      return;
    }
    showParsedRows(table.rows);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setSourceError("");
    setWorkbookSheets([]);
    setSelectedSheet("");
    setPreviewRows([]);

    if (file.size > MAX_FILE_BYTES) {
      setSourceError("That file is over 10 MB. Split it into smaller files and try again.");
      return;
    }

    const lowerName = file.name.toLowerCase();
    setReadingFile(true);
    try {
      if (lowerName.endsWith(".csv") || file.type === "text/csv") {
        const table = parseResultsTable(parseDelimitedRows(await file.text()));
        if (table.rows.length === 0) {
          setSourceError(table.error ?? "No result rows were found in that CSV.");
          return;
        }
        showParsedRows(table.rows);
        return;
      }

      if (lowerName.endsWith(".xlsx")) {
        const sheets = await readResultsWorkbook(file);
        setWorkbookSheets(sheets);
        const firstUsable = sheets.find((sheet) => sheet.table.rows.length > 0);
        if (!firstUsable) {
          setSourceError(sheets[0]?.table.error ?? "No result rows were found in that workbook.");
          return;
        }
        loadSheet(firstUsable);
        return;
      }

      setSourceError("Choose a .csv or .xlsx file.");
    } catch {
      setSourceError("That file could not be read. Check that it is a valid CSV or Excel workbook.");
    } finally {
      setReadingFile(false);
    }
  }

  function chooseAthlete(rowKey: string, registrationId: string) {
    setPreviewRows((rows) => rows.map((row) => {
      if (row.key !== rowKey) return row;
      const registration = byId.get(registrationId);
      return {
        ...row,
        registrationId,
        matchIssue: undefined,
        // Rebuild from the imported row and the newly chosen athlete so values
        // cannot carry over from a previously selected athlete.
        draft: registration ? draftFor(row.imported, registration) : row.draft,
      };
    }));
  }

  function updateDraft(rowKey: string, patch: Partial<Draft>) {
    setPreviewRows((rows) => rows.map((row) =>
      row.key === rowKey ? { ...row, draft: { ...row.draft, ...patch } } : row,
    ));
  }

  const rowStates = useMemo(() => previewRows.map((row) => {
    const registration = byId.get(row.registrationId);
    const original = registration ? draftFor({ sourceRow: row.imported.sourceRow }, registration) : null;
    const changed = Boolean(registration && original && !draftsEqual(row.draft, original));
    const invalidTime = Boolean(trimValue(row.draft.time) && !isValidRaceTime(row.draft.time));
    return { row, registration, original, changed, invalidTime };
  }), [previewRows, byId]);

  const matchedCount = rowStates.filter((state) => state.registration).length;
  const unmatchedCount = rowStates.length - matchedCount;
  const changedCount = rowStates.filter((state) => state.changed).length;
  const invalidCount = rowStates.filter((state) => state.invalidTime).length;
  const blockingInvalidCount = rowStates.filter(
    (state) => state.registration && state.invalidTime,
  ).length;

  async function applyChanges() {
    setApplyError("");
    if (blockingInvalidCount > 0) {
      setApplyError("Fix the highlighted times before applying.");
      return;
    }

    const results = rowStates
      .filter((state) => state.registration && state.original && state.changed)
      .map((state) => buildResultChange(
        state.registration!.id,
        {
          resultDistance: state.registration!.resultDistance,
          resultTime: state.registration!.resultTime,
          resultPlacement: state.registration!.resultPlacement,
          isPersonalBest: state.registration!.isPersonalBest,
          isTopResult: state.registration!.isTopResult,
        },
        state.row.draft,
      ))
      .filter((change): change is NonNullable<typeof change> => change !== null);

    if (results.length === 0) {
      setApplyError("There are no changes to apply.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/organiser/events/${eventId}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setApplyError(json?.error ?? "Could not apply the results.");
        return;
      }
      if (json?.invalidTimes?.length) {
        setApplyError("The server could not read one of the times. Check the highlighted rows.");
        return;
      }
      onImported(json?.updated ?? results.length);
    } catch {
      setApplyError("Could not apply the results. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasPreview = previewRows.length > 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[min(1120px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{hasPreview ? "Review imported results" : "Import results"}</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel workbook, or paste rows. Only result fields are imported; nothing is saved until you review and apply the changes.
          </DialogDescription>
        </DialogHeader>

        {!hasPreview && (
          <div className="space-y-5">
            <div className="rounded-xl border border-dark-lighter bg-dark-light/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary">
                    Startline results template
                  </p>
                  <p className="text-[13px] text-muted-light mt-1 max-w-[600px] leading-relaxed">
                    One athlete per row, with email, time, and placement together. No merged wave headings.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/organiser/events/${eventId}/results/template?format=csv`}
                    className="inline-flex items-center gap-2 rounded-lg border border-dark-lighter px-3 py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-light hover:border-primary hover:text-primary transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" /> CSV
                  </a>
                  <a
                    href={`/api/organiser/events/${eventId}/results/template?format=xlsx`}
                    className="inline-flex items-center gap-2 rounded-lg border border-dark-lighter px-3 py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-light hover:border-primary hover:text-primary transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-dark-lighter bg-dark px-5 py-8 text-center">
              <Upload className="w-7 h-7 text-primary mx-auto mb-3" />
              <p className="font-headline text-sm font-bold uppercase tracking-widest text-light">
                Choose a results file
              </p>
              <p className="text-[13px] text-muted mt-1 mb-4">
                CSV or Excel (.xlsx). Parsed in your browser; the file is not uploaded.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFile}
                className="sr-only"
              />
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={readingFile}>
                <Upload className="w-4 h-4" /> {readingFile ? "Reading…" : "Choose file"}
              </Button>
            </div>

            {workbookSheets.length > 1 && (
              <div className="max-w-sm">
                <label className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                  Worksheet
                </label>
                <FormSelect
                  aria-label="Worksheet"
                  value={selectedSheet}
                  onChange={(name) => {
                    const sheet = workbookSheets.find((candidate) => candidate.name === name);
                    if (sheet) loadSheet(sheet);
                  }}
                  options={workbookSheets.map((sheet) => ({
                    value: sheet.name,
                    label: `${sheet.name}${sheet.table.rows.length ? ` · ${sheet.table.rows.length} rows` : " · no results"}`,
                  }))}
                />
              </div>
            )}

            <div>
              <label htmlFor="results-paste" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Or paste rows from a spreadsheet
              </label>
              <textarea
                id="results-paste"
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                rows={6}
                placeholder={"email,time,placement\nalex.turner@example.com,41:05,8th / 512"}
                className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[13px] text-light font-mono placeholder:text-placeholder focus:border-primary focus:outline-none resize-y"
              />
              <div className="flex justify-end mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={previewPastedText}
                  disabled={!pasteText.trim()}
                >
                  Preview pasted data
                </Button>
              </div>
            </div>

            {sourceError && (
              <p className="flex items-start gap-2 text-[13px] text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {sourceError}
              </p>
            )}
          </div>
        )}

        {hasPreview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                  <span><span className="text-light">{matchedCount}</span> matched</span>
                  <span><span className="text-light">{changedCount}</span> changed</span>
                  {unmatchedCount > 0 && <span className="text-amber-300">{unmatchedCount} unmatched</span>}
                  {invalidCount > 0 && <span className="text-red-300">{invalidCount} invalid</span>}
                </div>
                {workbookSheets.length > 1 && (
                  <FormSelect
                    aria-label="Worksheet"
                    value={selectedSheet}
                    onChange={(name) => {
                      const sheet = workbookSheets.find((candidate) => candidate.name === name);
                      if (sheet) loadSheet(sheet);
                    }}
                    options={workbookSheets.map((sheet) => ({
                      value: sheet.name,
                      label: `${sheet.name}${sheet.table.rows.length ? ` · ${sheet.table.rows.length} rows` : " · no results"}`,
                    }))}
                    className="w-52"
                    triggerClassName="!py-1.5 !text-[12px]"
                  />
                )}
              </div>
              <Button type="button" variant="ghost" onClick={() => { setPreviewRows([]); setSourceError(""); setApplyError(""); }}>
                <ArrowLeft className="w-4 h-4" /> Choose another file
              </Button>
            </div>

            <p className="text-[12px] text-muted leading-relaxed">
              Blank cells in the file keep the saved result. Clear a field here to remove it.
              Unmatched rows are skipped until you choose an athlete.
            </p>

            <div className="max-h-[52vh] overflow-auto rounded-xl border border-dark-lighter">
              <table className="w-full min-w-[1060px] border-collapse">
                <thead className="sticky top-0 z-10 bg-dark-light">
                  <tr className="border-b border-white/10">
                    {["Row", "Athlete", "Bib", "Division", "Distance", "Time", "Placement", "PB", "Top"].map((heading) => (
                      <th
                        key={heading}
                        className="text-left px-2.5 py-2.5 font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowStates.map(({ row, registration, changed, invalidTime }) => {
                    const who = registration?.name ?? row.imported.email ?? row.imported.registrationId ?? "Unknown";
                    return (
                      <tr
                        key={row.key}
                        className={`border-b border-white/5 last:border-0 ${
                          !registration ? "bg-amber-400/[0.04]" : changed ? "bg-primary/[0.035]" : ""
                        }`}
                      >
                        <td className="px-2.5 py-2 font-headline text-[11px] text-muted-dark">{row.imported.sourceRow}</td>
                        <td className="px-2.5 py-2 min-w-[220px]">
                          {registration ? (
                            <>
                              <div className="font-headline text-[13px] font-bold text-white/90">{registration.name}</div>
                              <div className="text-[11px] text-muted-dark truncate max-w-[230px]">{registration.email}</div>
                              {changed && (
                                <div className="font-headline text-[9px] uppercase tracking-widest text-primary mt-0.5">
                                  Changed
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="text-[12px] text-amber-200 truncate max-w-[230px]">
                                {who}
                              </div>
                              <FormSelect
                                aria-label={`Match athlete for row ${row.imported.sourceRow}`}
                                value={row.registrationId}
                                onChange={(id) => chooseAthlete(row.key, id)}
                                options={[
                                  { value: "", label: "Choose athlete…" },
                                  ...sortedRegistrations.map((candidate) => ({
                                    value: candidate.id,
                                    label: `${candidate.name} — ${candidate.email}`,
                                  })),
                                ]}
                                triggerClassName="!py-1.5 !text-[12px]"
                              />
                              {row.matchIssue && (
                                <p className="text-[10.5px] text-amber-300/80 max-w-[250px]">{row.matchIssue}</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 font-headline text-[12px] text-muted-light whitespace-nowrap">
                          {registration?.bibNumber ? `#${registration.bibNumber}` : "-"}
                        </td>
                        <td className="px-2.5 py-2 text-[12px] text-muted-light min-w-[100px]">
                          {registration?.category || "-"}
                        </td>
                        <td className="px-2.5 py-2 min-w-[110px]">
                          <ResultFieldInput
                            label={`Distance for ${who}`}
                            value={row.draft.distance}
                            onChange={(distance) => updateDraft(row.key, { distance })}
                          />
                        </td>
                        <td className="px-2.5 py-2 min-w-[105px]">
                          <ResultFieldInput
                            label={`Time for ${who}`}
                            value={row.draft.time}
                            onChange={(time) => updateDraft(row.key, { time })}
                            invalid={invalidTime}
                          />
                          {invalidTime && (
                            <p className="text-[10.5px] text-red-300 mt-1 whitespace-nowrap">Use 41:05 or 1:08:22</p>
                          )}
                        </td>
                        <td className="px-2.5 py-2 min-w-[115px]">
                          <ResultFieldInput
                            label={`Placement for ${who}`}
                            value={row.draft.placement}
                            onChange={(placement) => updateDraft(row.key, { placement })}
                          />
                        </td>
                        <td className="px-2.5 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Personal best for ${who}`}
                            checked={row.draft.isPersonalBest}
                            onChange={(event) => updateDraft(row.key, { isPersonalBest: event.target.checked })}
                            className="rounded border-dark-lighter bg-dark text-primary focus:ring-primary focus:ring-offset-0"
                          />
                        </td>
                        <td className="px-2.5 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Top result for ${who}`}
                            checked={row.draft.isTopResult}
                            onChange={(event) => updateDraft(row.key, { isTopResult: event.target.checked })}
                            className="rounded border-dark-lighter bg-dark text-primary focus:ring-primary focus:ring-offset-0"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {unmatchedCount > 0 && (
              <p className="flex items-start gap-2 text-[12.5px] text-amber-200/90">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Unmatched rows will not be applied.
              </p>
            )}
            {applyError && (
              <p className="flex items-start gap-2 text-[13px] text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {applyError}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={applyChanges} disabled={submitting || blockingInvalidCount > 0 || changedCount === 0}>
                {submitting ? "Applying…" : `Apply ${changedCount} change${changedCount === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {!hasPreview && (
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <a
              href={`/api/organiser/events/${eventId}/results/template?format=xlsx`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dark-lighter text-light font-headline text-[11px] font-bold uppercase tracking-widest hover:border-primary hover:text-primary transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download template
            </a>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
