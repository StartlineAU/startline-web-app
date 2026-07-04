"use client";

import { useEffect, useRef, useState } from "react";
import { loadMapsScript } from "./AddressAutocomplete";

interface Props {
  value: string;
  onChange: (city: string) => void;
  onStateChange?: (state: string) => void;
  apiKey?: string;
  placeholder?: string;
  className?: string;
}

export default function SuburbAutocomplete({
  value,
  onChange,
  onStateChange,
  apiKey: apiKeyProp,
  placeholder = "e.g. Melbourne",
  className = "",
}: Props) {
  const apiKey = apiKeyProp ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const onChangeRef      = useRef(onChange);
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onChangeRef.current      = onChange;      }, [onChange]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  const inputRef = useRef<HTMLInputElement>(null);
  const acRef    = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.google?.maps);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!apiKey || ready) return;
    loadMapsScript(apiKey).then(() => setReady(true)).catch(() => setError(true));
  }, [apiKey, ready]);

  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return;

    acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "name"],
      types:  ["(cities)"],
    });

    acRef.current.addListener("place_changed", () => {
      const place = acRef.current!.getPlace();
      if (!place?.address_components) return;

      const get = (type: string, nameType: "long_name" | "short_name" = "long_name") =>
        place.address_components!.find(c => c.types.includes(type))?.[nameType] ?? "";

      const city  = get("locality") || get("sublocality_level_1") || get("administrative_area_level_2") || place.name || "";
      const state = get("administrative_area_level_1", "short_name").toLowerCase();

      onChangeRef.current(city);
      if (state) onStateChangeRef.current?.(state);
    });
  }, [ready]);

  if (!apiKey || error) {
    return (
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className={className} />
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
