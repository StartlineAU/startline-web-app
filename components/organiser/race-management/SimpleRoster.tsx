"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCheck, Pencil, Search } from "lucide-react";

export interface RosterAthlete {
  id: string;
  name: string;
  email: string;
  /** The ticket tier they bought. */
  tier: string | null;
  bibNumber: string | null;
  medicalNotes: string | null;
  checkedInAt: string | null;
}

const PAGE = 50;

/** Race-day check-ins read as a clock time; older ones also show the date. */
function checkInLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}, ${time}`;
}

/**
 * The registrations list for an event without start waves (#566): who is in,
 * what they bought, and whether they have checked in. Bibs appear only once the
 * organiser turns them on. Waves bring back the full allocation board.
 */
export default function SimpleRoster({
  athletes,
  showBibs,
  onEdit,
  actions,
}: {
  athletes: RosterAthlete[];
  showBibs: boolean;
  onEdit: (athleteId: string) => void;
  /** Buttons that sit beside the search field (export, assign bibs). */
  actions?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? athletes.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q) ||
            (showBibs && (a.bibNumber ?? "").toLowerCase().includes(q)),
        )
      : athletes;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }, [athletes, query, showBibs]);

  const visible = filtered.slice(0, limit);
  const header = "font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark";

  return (
    <div className="space-y-3" data-testid="simple-roster">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="relative flex-1 sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
          placeholder={showBibs ? "Search by name, email, or bib" : "Search by name or email"}
          aria-label="Search athletes"
          className="w-full bg-dark border border-dark-lighter rounded-lg pl-10 pr-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
        />
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:ml-auto">{actions}</div>}
      </div>

      {athletes.length === 0 ? (
        <p className="px-3 py-8 text-center text-[13px] text-muted-dark">No confirmed registrations yet.</p>
      ) : filtered.length === 0 ? (
        <p className="px-3 py-6 text-[13px] text-muted-dark">No athletes match your search.</p>
      ) : (
        <div role="table" aria-label="Registrations">
          <div role="row" className="flex items-center gap-3 px-2 pb-1">
            <span role="columnheader" className={`min-w-0 flex-1 ${header}`}>Athlete</span>
            <span role="columnheader" className={`hidden sm:block w-32 ${header}`}>Ticket</span>
            {showBibs && <span role="columnheader" className={`w-14 text-right ${header}`}>Bib</span>}
            <span role="columnheader" className={`w-[72px] sm:w-28 text-right ${header}`}>Check-in</span>
            <span className="w-6" aria-hidden />
          </div>
          {visible.map((a) => (
            <div key={a.id} role="row" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] group">
              <span role="cell" className="min-w-0 flex-1">
                <span className="font-headline text-[13.5px] font-bold text-white/90 truncate block">
                  {a.name}
                  {a.medicalNotes && (
                    <span
                      title={`Medical: ${a.medicalNotes}`}
                      className="ml-2 inline-flex items-center gap-1 align-middle font-headline text-[9px] font-bold uppercase tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5"
                    >
                      <AlertCircle className="w-2.5 h-2.5" /> Medical
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-muted-dark truncate mt-0.5">
                  {a.email}
                  <span className="sm:hidden">{a.tier ? ` · ${a.tier}` : ""}</span>
                </span>
              </span>
              <span role="cell" className="hidden sm:block w-32 truncate font-headline text-[12px] text-muted-light">
                {a.tier ?? "-"}
              </span>
              {showBibs && (
                <span role="cell" className="w-14 text-right font-headline text-[13px] font-bold text-muted-light">
                  {a.bibNumber ? `#${a.bibNumber}` : "-"}
                </span>
              )}
              <span role="cell" className="w-[72px] sm:w-28 flex justify-end">
                {a.checkedInAt ? (
                  <span
                    data-testid="roster-check-in"
                    title={`Checked in ${new Date(a.checkedInAt).toLocaleString("en-AU")}`}
                    className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/30 rounded px-1.5 py-0.5 text-right sm:whitespace-nowrap"
                  >
                    <CheckCheck className="w-3 h-3" /> {checkInLabel(a.checkedInAt)}
                  </span>
                ) : (
                  <span className="text-[12px] text-muted-dark" aria-label="Not checked in">—</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onEdit(a.id)}
                aria-label={`Edit ${a.name}`}
                className="w-6 shrink-0 p-1 text-muted-dark hover:text-primary transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {filtered.length > visible.length && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="w-full py-2 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors"
            >
              Show {Math.min(PAGE, filtered.length - visible.length)} more of {filtered.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
