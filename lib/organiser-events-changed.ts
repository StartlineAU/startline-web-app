"use client";

import { useEffect, useRef } from "react";

/* The organiser pages fetch their events once on mount, so an approval that
   lands while one is open left it showing "Pending" next to the notification
   saying it was published. The navbar already polls notifications; when a new
   one arrives it fires this, and any page showing event data reloads. */
const EVENT_NAME = "startline:organiser-events-changed";

export function announceOrganiserEventsChanged() {
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useOnOrganiserEventsChanged(callback: () => void) {
  const ref = useRef(callback);
  useEffect(() => { ref.current = callback; });

  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);
}
