"use client";

import { useEffect, useRef, useState } from "react";

interface SuburbSuggestion {
  city: string;
  state: string;
  eventCount: number;
  /** Present when the query matched a venue rather than the city name. */
  venue?: string;
  /** Present only on nearby fallback results, in km from the searched place. */
  distanceKm?: number;
}

/** A state's match for a name that exists in more than one state. */
interface PlaceChoice {
  label: string;
  city: string;
  stateCode: string;
  stateName: string;
}

type Option =
  | { kind: "place"; item: PlaceChoice }
  | { kind: "event"; item: SuburbSuggestion };

interface Props {
  value: string;
  onChange: (city: string) => void;
  onSelect?: (city: string) => void;
  /** Receives the current text so a fast Enter cannot use a stale value. */
  onEnter?: (query?: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * The event field's active selection. Passed through so suggestions and
   * their counts reflect what the listing would actually show, rather than
   * offering a suburb whose only events this filter excludes.
   */
  filter?: { discipline: string; division: string | null } | null;
}

/**
 * Location typeahead for the search bars.
 *
 * Distinct from SuburbAutocomplete, which offers any Australian locality from
 * the geocoder and is what the organiser's event form needs. Here the aim is
 * the opposite: only suggest places that actually host events, so a suggestion
 * can never lead to an empty listing. When the typed suburb hosts none, the
 * endpoint returns the nearest suburbs that do, flagged as nearby.
 */
export default function EventLocationAutocomplete({
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder = "State, city, or suburb",
  className = "",
  filter,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [nearby, setNearby] = useState(false);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestRef = useRef(0);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) &&
          listRef.current && !listRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const fetchSuggestions = async (q: string) => {
    if (q.trim().length < 2) { setOptions([]); setOpen(false); return; }
    const seq = ++requestRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (filter?.discipline) params.set("type", filter.discipline);
      if (filter?.division) params.set("division", filter.division);
      const res = await fetch(`/api/events/suburbs?${params}`);
      const data = await res.json();
      if (seq !== requestRef.current) return;
      const results: SuburbSuggestion[] = data.results ?? [];
      const places: PlaceChoice[] = data.choices ?? [];
      const next: Option[] = [
        ...places.map((item) => ({ kind: "place" as const, item })),
        ...results.map((item) => ({ kind: "event" as const, item })),
      ];
      setOptions(next);
      setNearby(Boolean(data.nearby));
      setSearched(data.searched ?? q.trim());
      setOpen(next.length > 0);
      setActiveIdx(-1);
    } catch {
      if (seq === requestRef.current) setOptions([]);
    } finally {
      if (seq === requestRef.current) setLoading(false);
    }
  };

  // Re-run against the new filter so the list never shows counts taken under
  // the previous one. Setting state here is the point: the counts on screen are
  // stale until the refetch lands.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (value.trim().length >= 2) fetchSuggestions(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter?.discipline, filter?.division]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleInput = (text: string) => {
    onChange(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(text), 250);
  };

  const select = (option: Option) => {
    if (option.kind === "place") {
      // The label carries the state, so the distance search resolves to the
      // place the visitor chose instead of the first match for the plain name.
      onChange(option.item.label);
      setOpen(false);
      onSelect?.(option.item.label);
      return;
    }

    // A venue match narrows to that venue; the listing's where filter matches
    // venue as well as city, so the more specific term is the useful one.
    const text = option.item.venue ?? option.item.city;
    onChange(text);
    setOpen(false);
    onSelect?.(text);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Enter") {
      if (open && activeIdx >= 0) {
        e.preventDefault();
        select(options[activeIdx]);
      } else if (open && options.some((option) => option.kind === "place")) {
        // Several states match: make the visitor choose rather than silently
        // searching the first one (#352).
        e.preventDefault();
      } else {
        onEnter?.(value);
      }
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    }
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (options.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={open && options.length > 0 ? "suburb-event-suggestions" : undefined}
        aria-autocomplete="list"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {open && options.length > 0 && (
        <div ref={listRef} id="suburb-event-suggestions" data-testid="suburb-suggestions"
          className="absolute top-full left-0 mt-2 z-50 w-full min-w-[280px] bg-dark border border-dark-lighter rounded-xl shadow-xl overflow-hidden modal-in">
          {options.some((option) => option.kind === "place") && (
            <div className="px-4 pt-2.5 pb-1 font-headline text-[10px] font-black uppercase tracking-widest text-muted-dark">
              Several places match · choose one
            </div>
          )}
          {nearby && !options.some((option) => option.kind === "place") && (
            <div className="px-4 pt-2.5 pb-1 font-headline text-[10px] font-black uppercase tracking-widest text-muted-dark">
              No events in {searched} · nearest instead
            </div>
          )}
          {options.map((option, i) => {
            if (option.kind === "place") {
              const item = option.item;
              return (
                <button key={`place-${item.label}`} type="button"
                  data-testid="place-choice"
                  onClick={() => select(option)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full px-4 py-2.5 text-left block transition-colors
                    ${i === activeIdx ? "bg-primary/10" : "hover:bg-white/5"}`}>
                  <span className={`block font-headline text-[14px] truncate ${i === activeIdx ? "text-primary" : "text-light"}`}>
                    {item.label}
                  </span>
                  <span className="block font-headline text-[11px] uppercase tracking-widest text-muted truncate">
                    {item.stateName || item.stateCode.toUpperCase()}
                  </span>
                </button>
              );
            }

            const item = option.item;
            return (
              <button key={`${item.city}-${item.state}-${item.venue ?? ""}`} type="button"
                data-testid="suburb-suggestion"
                onClick={() => select(option)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full px-4 py-2.5 text-left block transition-colors
                  ${i === activeIdx ? "bg-primary/10" : "hover:bg-white/5"}`}>
                <span className={`block font-headline text-[14px] truncate ${i === activeIdx ? "text-primary" : "text-light"}`}>
                  {item.venue ?? item.city}
                  {!item.venue && `, ${item.state.toUpperCase()}`}
                </span>
                <span className="block font-headline text-[11px] uppercase tracking-widest text-muted truncate">
                  {item.venue && `${item.city}, ${item.state.toUpperCase()} · `}
                  {item.distanceKm != null && `${item.distanceKm} km · `}
                  {item.eventCount} {item.eventCount === 1 ? "event" : "events"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
