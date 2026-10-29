"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DEFAULT_EXPORT_COLUMN_KEYS,
  EXPORT_COLUMNS,
  type ExportColumnKey,
} from "@/lib/registration-export";

export default function ExportMenu({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<ExportColumnKey>>(
    () => new Set(DEFAULT_EXPORT_COLUMN_KEYS),
  );

  const base = `/api/organiser/events/${eventId}/registrations/export`;
  const orderedKeys = EXPORT_COLUMNS.map((c) => c.key).filter((k) => selected.has(k));
  const columnsQuery = encodeURIComponent(orderedKeys.join(","));

  const toggleColumn = (key: ExportColumnKey, required?: boolean) => {
    if (required) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (!next.has("name")) next.add("name");
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(DEFAULT_EXPORT_COLUMN_KEYS));
  const selectMinimal = () => setSelected(new Set<ExportColumnKey>(["name"]));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Download className="w-4 h-4" /> Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle>Export registrations</DialogTitle>
            </div>
            <DialogDescription>
              Choose which columns to include, then download as Excel or a PDF start list.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
              Columns to include
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={selectAll}
                className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={selectMinimal}
                className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-light hover:text-white transition-colors"
              >
                Name only
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-dark-lighter bg-dark-light/40 px-2 py-2 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            {EXPORT_COLUMNS.map((col) => {
              const checked = selected.has(col.key);
              return (
                <label
                  key={col.key}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    col.required ? "opacity-80" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={col.required}
                    onChange={() => toggleColumn(col.key, col.required)}
                    className="rounded border-dark-lighter bg-dark text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span className="text-[13px] text-white/85">{col.label}</span>
                  {col.required && (
                    <span className="ml-auto font-headline text-[9px] uppercase tracking-widest text-muted-light">
                      Required
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2 !items-stretch mt-4">
            <a
              role="menuitem"
              href={`${base}?format=xlsx&columns=${columnsQuery}`}
              onClick={() => setOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-br from-[rgb(194,236,119)] to-[rgb(179,225,83)] text-dark font-headline text-[13px] font-bold uppercase tracking-widest shadow-machined hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel workbook
            </a>
            <a
              role="menuitem"
              href={`${base}?format=pdf`}
              onClick={() => setOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-dark-lighter bg-transparent text-light font-headline text-[13px] font-bold uppercase tracking-widest hover:bg-dark-light hover:border-primary transition-colors"
            >
              <FileText className="w-4 h-4" /> PDF start list
            </a>
            <p className="text-[11px] text-muted-light text-center leading-snug pt-1">
              Column choices apply to Excel. PDF uses the standard start-list layout.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
