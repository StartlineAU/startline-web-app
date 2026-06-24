"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Map, { MapRef, Marker, NavigationControl } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ExternalLink } from "lucide-react";
import type { UserEvent } from "@/types";
import { EVENT_TYPE_LABELS, STATE_LABELS } from "@/types";
import { formatEventDate, formatTime } from "@/lib/utils";
import { eventLngLat, filterMapEvents } from "@/lib/map-events";

const AUSTRALIA_VIEW = {
  latitude: -25.2744,
  longitude: 133.7751,
  zoom: 3.25,
};

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const mapStyle =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ?? "mapbox://styles/mapbox/dark-v11";

interface Props {
  events: UserEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

function EventPinCard({
  event,
  expanded,
}: {
  event: UserEvent;
  expanded: boolean;
}) {
  return (
    <div className="relative mb-1 pointer-events-auto">
      <div
        className={`rounded-xl border bg-dark shadow-2xl ${
          expanded
            ? "w-[min(18rem,calc(100vw-2rem))] border-primary/40 p-4"
            : "w-52 border-dark-lighter p-3"
        }`}
      >
        <p className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
          {EVENT_TYPE_LABELS[event.type]}
        </p>
        <p className="font-headline text-sm font-black italic tracking-tight text-light leading-tight mb-1">
          {event.title}
        </p>
        <p className="font-headline text-[11px] uppercase tracking-widest text-muted">
          {event.city}, {STATE_LABELS[event.state]}
        </p>
        <p className="font-headline text-[11px] uppercase tracking-widest text-muted mt-1">
          {formatEventDate(event.date)}
          {expanded && ` · ${formatTime(event.time)}`}
        </p>
        {expanded && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              href={`/events/${event.id}`}
              className="inline-flex items-center gap-2 border border-dark-lighter text-muted font-headline text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl hover:border-primary/50 hover:text-light transition-colors"
            >
              More Info
            </Link>
            {event.registrationUrl && (
              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-machined text-dark font-headline text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl machined-button-shadow"
              >
                Register
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
      <div
        className={`absolute left-1/2 top-full -translate-x-1/2 -mt-px h-2.5 w-2.5 rotate-45 border-r border-b bg-dark ${
          expanded ? "border-primary/40" : "border-dark-lighter"
        }`}
        aria-hidden
      />
    </div>
  );
}

export default function EventsMap({ events, selectedId, onSelect, className = "" }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const onSelectRef = useRef(onSelect);
  const hasFramedInitial = useRef(false);
  const lastFlownIdRef = useRef<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeMapStyle, setActiveMapStyle] = useState(mapStyle);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const mapEvents = useMemo(() => filterMapEvents(events), [events]);

  const frameMapView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded || mapEvents.length === 0) return;

    if (selectedId) {
      hasFramedInitial.current = true;
      const event = mapEvents.find((e) => e.id === selectedId);
      const ll = event ? eventLngLat(event) : null;
      if (ll && lastFlownIdRef.current !== selectedId) {
        map.flyTo({
          center: [ll.lng, ll.lat],
          zoom: 11,
          duration: 900,
        });
        lastFlownIdRef.current = selectedId;
      }
      return;
    }

    lastFlownIdRef.current = null;

    // User deselected (or map already framed) — keep camera where it is
    if (hasFramedInitial.current) return;
    hasFramedInitial.current = true;

    if (mapEvents.length === 1) {
      const ll = eventLngLat(mapEvents[0]);
      if (!ll) return;
      map.flyTo({ center: [ll.lng, ll.lat], zoom: 11, duration: 900 });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    mapEvents.forEach((event) => {
      const ll = eventLngLat(event);
      if (ll) bounds.extend([ll.lng, ll.lat]);
    });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 100, maxZoom: 10, duration: 900 });
    }
  }, [mapEvents, mapLoaded, selectedId]);

  useEffect(() => {
    frameMapView();
  }, [frameMapView]);

  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target?.closest(".mapboxgl-marker")) return;
      if (target?.closest(".mapboxgl-ctrl")) return;
      setHoveredId(null);
      onSelectRef.current(null);
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [mapLoaded]);

  if (!mapboxToken) {
    return (
      <div className={`flex items-center justify-center bg-dark ${className}`}>
        <div className="max-w-xl text-center px-8">
          <p className="font-headline text-sm uppercase tracking-widest text-primary mb-2">
            Mapbox Token Missing
          </p>
          <p className="font-headline text-base text-muted leading-relaxed">
            Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment to enable the interactive map.
          </p>
        </div>
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className={`flex items-center justify-center bg-dark ${className}`}>
        <p className="font-headline text-sm uppercase tracking-widest text-muted">
          Loading map...
        </p>
      </div>
    );
  }

  if (mapEvents.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-dark ${className}`}>
        <p className="font-headline text-sm uppercase tracking-widest text-muted text-center px-8">
          No events with map coordinates yet.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative min-h-[360px] ${className}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={AUSTRALIA_VIEW}
        style={{ width: "100%", height: "100%" }}
        mapStyle={activeMapStyle}
        onLoad={() => setMapLoaded(true)}
        onError={() => {
          if (activeMapStyle !== "mapbox://styles/mapbox/dark-v11") {
            setActiveMapStyle("mapbox://styles/mapbox/dark-v11");
          }
        }}
      >
        <NavigationControl position="top-right" />
        {mapLoaded &&
          mapEvents.map((event) => {
            const ll = eventLngLat(event);
            if (!ll) return null;
            const isSelected = selectedId === event.id;
            const isHovered = hoveredId === event.id;
            const showCard = isSelected || isHovered;

            return (
              <Marker
                key={event.id}
                longitude={ll.lng}
                latitude={ll.lat}
                anchor="bottom"
              >
                <div
                  className="flex flex-col items-center pointer-events-auto"
                  onMouseEnter={() => setHoveredId(event.id)}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === event.id ? null : current))
                  }
                >
                  {showCard && <EventPinCard event={event} expanded={isSelected} />}

                  {showCard && (
                    <div
                      className={`w-0.5 h-3 shrink-0 ${isSelected ? "bg-primary" : "bg-primary/50"}`}
                      aria-hidden
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => onSelect(event.id)}
                    className={`shrink-0 rounded-full border-2 border-white/90 shadow-[0_0_0_2px_rgba(0,0,0,0.35)] transition-all ${
                      isSelected
                        ? "w-5 h-5 bg-primary scale-125 shadow-[0_0_0_4px_rgba(179,225,83,0.35)]"
                        : "w-4 h-4 bg-primary hover:scale-110"
                    }`}
                    aria-label={`View ${event.title}`}
                    aria-pressed={isSelected}
                  />
                </div>
              </Marker>
            );
          })}
      </Map>
    </div>
  );
}
