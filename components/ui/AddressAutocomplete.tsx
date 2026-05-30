"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

export type AddressResult = {
  address: string;
  city:    string;
  state:   string;
  venue:   string;
};

interface Props {
  value:        string;
  onChange:     (raw: string) => void;
  onSelect:     (result: AddressResult) => void;
  apiKey?:      string;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
}

let scriptPromise: Promise<void> | null = null;

function loadMapsScript(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (typeof window !== "undefined" && window.google?.maps) {
    return (scriptPromise = Promise.resolve());
  }
  scriptPromise = new Promise((resolve, reject) => {
    const cb = "__gmapsLoaded";
    (window as unknown as Record<string, unknown>)[cb] = resolve;
    const s = document.createElement("script");
    s.src     = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${cb}`;
    s.async   = true;
    s.defer   = true;
    s.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

const AU_STATES = ["nsw","vic","qld","wa","sa","tas","act","nt"];

function extractComponents(place: google.maps.places.PlaceResult): AddressResult {
  const components = place.address_components ?? [];
  const get = (type: string, nameType: "long_name" | "short_name" = "long_name") =>
    components.find((c) => c.types.includes(type))?.[nameType] ?? "";

  let address = [get("street_number"), get("route")].filter(Boolean).join(" ");
  let city    = get("locality") || get("sublocality_level_1") || get("neighborhood") || get("administrative_area_level_2");
  let state   = get("administrative_area_level_1", "short_name").toLowerCase();
  const venue = place.name && !place.name.match(/^\d/) ? place.name : "";

  // Fallback: parse formatted_address if components didn't give us what we need
  if ((!city || !state) && place.formatted_address) {
    const parts = place.formatted_address.split(",").map(s => s.trim());
    for (const part of parts) {
      const tokens = part.split(" ").map(t => t.trim());
      const stateToken = tokens.find(t => AU_STATES.includes(t.toLowerCase()));
      if (stateToken) {
        if (!state) state = stateToken.toLowerCase();
        if (!city)  city  = tokens.slice(0, tokens.indexOf(stateToken)).join(" ");
        break;
      }
    }
    if (!address) address = parts[0] ?? "";
  }

  return { address, city, state, venue };
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  apiKey: apiKeyProp,
  placeholder = "Start typing an address…",
  className = "",
  disabled = false,
}: Props) {
  const apiKey = apiKeyProp ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  // Stable refs for callbacks — never cause the Autocomplete to rebuild
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const inputRef = useRef<HTMLInputElement>(null);
  const acRef    = useRef<google.maps.places.Autocomplete | null>(null);

  // Synchronously true if Maps is already cached in this browser session
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && !!window.google?.maps,
  );
  const [error, setError] = useState(false);

  // Load the Maps script (no-op if already loaded)
  useEffect(() => {
    if (!apiKey || ready) return;
    loadMapsScript(apiKey)
      .then(() => setReady(true))
      .catch(() => setError(true));
  }, [apiKey, ready]);

  // Attach Autocomplete once — never rebuild it
  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return;

    acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "formatted_address", "name"],
      types:  ["geocode", "establishment"],
    });

    acRef.current.addListener("place_changed", () => {
      const place = acRef.current!.getPlace();
      if (!place) return;
      const result = extractComponents(place);
      onChangeRef.current(result.address || place.formatted_address || "");
      onSelectRef.current(result);
    });
  }, [ready]);

  if (!apiKey || error) {
    return (
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
        />
        {!apiKey && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-amber-500 pointer-events-none">
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-[10px] font-headline uppercase tracking-wider">No API key</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      autoComplete="off"
    />
  );
}
