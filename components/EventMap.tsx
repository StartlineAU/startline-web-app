"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { UserEvent } from "@/types";
import { getEventCoords } from "@/lib/australia-coords";

interface EventMapProps {
  events: UserEvent[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
  initialCenter?: { lng: number; lat: number; zoom: number };
}

export interface EventMapHandle {
  flyTo: (id: string) => void;
  fitFilteredBounds: () => void;
  stopSpin: () => void;
}

const EVENT_MARKER_COLOR = "#B3E153";
const EVENT_MARKER_SIZE = 10;

const EventMap = forwardRef<EventMapHandle, EventMapProps>(function EventMap({ events, selectedId, onMarkerClick, initialCenter }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const rotationRef = useRef<number>(0);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const defaultCenter = useRef(initialCenter ?? { lng: 133.7751, lat: -25.2744, zoom: 1 });

  function fitBounds() {
    if (!mapRef.current || events.length === 0) return;
    const coords = events.map((e) => {
      const [lat, lng] = getEventCoords(e.city, e.state);
      return [lng, lat] as [number, number];
    });
    const sw: [number, number] = [Infinity, Infinity];
    const ne: [number, number] = [-Infinity, -Infinity];
    coords.forEach(([lng, lat]) => {
      sw[0] = Math.min(sw[0], lng);
      sw[1] = Math.min(sw[1], lat);
      ne[0] = Math.max(ne[0], lng);
      ne[1] = Math.max(ne[1], lat);
    });
    mapRef.current.fitBounds([sw, ne], { padding: 80, maxZoom: 10, duration: 1200 });
  }

  function resumeSpin(delay = 3000) {
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      if (!selectedId && mapRef.current && !rotationRef.current) {
        rotationRef.current = requestAnimationFrame(spin);
      }
    }, delay);
  }

  function spin() {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    center.lng += 0.15;
    mapRef.current.setCenter(center);
    rotationRef.current = requestAnimationFrame(spin);
  }

  useImperativeHandle(ref, () => ({
    flyTo(id: string) {
      const event = events.find((e) => e.id === id);
      if (!event || !mapRef.current) return;
      const [lat, lng] = getEventCoords(event.city, event.state);
      mapRef.current.flyTo({ center: [lng, lat], zoom: 6, duration: 1500 });
    },
    fitFilteredBounds: fitBounds,
    stopSpin() {
      if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
      rotationRef.current = 0;
    },
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Ensure layout has settled (especially on client-side navigation)
    requestAnimationFrame(() => {
      if (!containerRef.current || mapRef.current) return;
      initMap();
    });

    return () => {
      if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
      if (mapRef.current) {
        roRef.current?.disconnect();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const roRef = useRef<ResizeObserver | null>(null);

  function initMap() {
    if (!containerRef.current || mapRef.current) return;
    const ctr = initialCenter ?? { lng: 133.7751, lat: -25.2744, zoom: 1 };
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [ctr.lng, ctr.lat],
      zoom: ctr.zoom,
      minZoom: 1,
      attributionControl: false,
      dragRotate: true,
    });

    map.on("error", (e) => console.error("Map error:", e));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    map.on("load", () => {
      map.resize();
      if (!rotationRef.current) rotationRef.current = requestAnimationFrame(spin);
    });

    roRef.current = new ResizeObserver(() => map.resize());
    roRef.current.observe(containerRef.current);

    function onMouseDown() {
      if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
    }

    function onMouseUp() {
      resumeSpin(3000);
    }

    map.on("mousedown", onMouseDown);
    map.on("mouseup", onMouseUp);
    rotationRef.current = requestAnimationFrame(spin);
  }

  // Update markers when events change
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    events.forEach((event) => {
      const [lat, lng] = getEventCoords(event.city, event.state);

      const el = document.createElement("div");
      el.className = "cursor-pointer transition-all duration-300";
      el.style.width = `${EVENT_MARKER_SIZE}px`;
      el.style.height = `${EVENT_MARKER_SIZE}px`;
      el.style.borderRadius = "50%";
      el.style.background = EVENT_MARKER_COLOR;
      el.style.boxShadow = `0 0 8px ${EVENT_MARKER_COLOR}80`;
      el.style.border = "2px solid #000";

      el.addEventListener("click", () => onMarkerClick(event.id));

      el.addEventListener("mouseenter", () => {
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.boxShadow = `0 0 16px ${EVENT_MARKER_COLOR}`;
        el.style.zIndex = "10";
      });
      el.addEventListener("mouseleave", () => {
        el.style.width = `${EVENT_MARKER_SIZE}px`;
        el.style.height = `${EVENT_MARKER_SIZE}px`;
        el.style.boxShadow = `0 0 8px ${EVENT_MARKER_COLOR}80`;
        el.style.zIndex = "1";
      });

      const popup = new maplibregl.Popup({ offset: 10, closeButton: false })
        .setHTML(
          `<div style="font-family:system-ui;font-size:12px;font-weight:600;color:#111;max-width:180px;text-align:center">${event.title}</div>`
        );

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [events, onMarkerClick, selectedId]);

  // Update selected marker style
  useEffect(() => {
    markersRef.current.forEach((m, i) => {
      const el = m.getElement();
      const event = events[i];
      if (event?.id === selectedId) {
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.background = "#fff";
        el.style.boxShadow = `0 0 24px ${EVENT_MARKER_COLOR}`;
        el.style.zIndex = "20";
      } else {
        el.style.width = `${EVENT_MARKER_SIZE}px`;
        el.style.height = `${EVENT_MARKER_SIZE}px`;
        el.style.background = EVENT_MARKER_COLOR;
        el.style.boxShadow = `0 0 8px ${EVENT_MARKER_COLOR}80`;
        el.style.zIndex = "1";
      }
    });
  }, [selectedId, events]);

  // Auto-fit bounds when filter results change
  const filterKeyRef = useRef("");
  const isFirstFit = useRef(true);

  useEffect(() => {
    if (!mapRef.current) return;
    const key = events.map((e) => e.id).join(",");
    if (key === filterKeyRef.current) return;
    filterKeyRef.current = key;

    if (isFirstFit.current) {
      isFirstFit.current = false;
      return;
    }

    if (events.length === 0) {
      if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
      mapRef.current.flyTo({ center: [defaultCenter.current.lng, defaultCenter.current.lat], zoom: defaultCenter.current.zoom, duration: 1000 });
      rotationRef.current = requestAnimationFrame(spin);
      return;
    }

    fitBounds();
    if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
    resumeSpin(2500);
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume spin and zoom out when deselected
  useEffect(() => {
    if (!selectedId && mapRef.current) {
      mapRef.current.flyTo({ center: [defaultCenter.current.lng, defaultCenter.current.lat], zoom: defaultCenter.current.zoom, duration: 1200 });
      if (!rotationRef.current) {
        const t = setTimeout(() => { rotationRef.current = requestAnimationFrame(spin); }, 1500);
        return () => clearTimeout(t);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default EventMap;
