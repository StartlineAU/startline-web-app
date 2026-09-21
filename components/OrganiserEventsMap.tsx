"use client";

import { useCallback, useState } from "react";
import type { UserEvent } from "@/types";
import EventMap from "@/components/EventMap";
import { nextMapSelection } from "@/lib/map-events";

/**
 * The map on an organiser's profile.
 *
 * EventMap only draws its expanded card, with the More Info and Register
 * buttons, for the selected pin. The profile used to pass no selection and no
 * click handler, so pins only showed the hover preview and there was no way
 * through to the event (#338). This holds the selection the way the discovery
 * page does: tap a pin to open it, tap it again or the map to close it.
 */
export default function OrganiserEventsMap({ events }: { events: UserEvent[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId((prev) => nextMapSelection(prev, id));
  }, []);

  return (
    <EventMap
      events={events}
      selectedId={selectedId}
      onMarkerClick={handleMarkerClick}
    />
  );
}
