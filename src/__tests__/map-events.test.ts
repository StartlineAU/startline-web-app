import { describe, it, expect } from "vitest";
import { eventLngLat, hasCoordinates, filterMapEvents } from "@/lib/map-events";
import type { UserEvent } from "@/types";

const baseEvent: UserEvent = {
  id: "1",
  title: "Test Event",
  description: "Desc",
  date: "2026-08-15",
  time: "09:00",
  location: "Venue",
  city: "Melbourne",
  state: "vic",
  type: "running",
  format: "individual",
  level: "open",
  image: "",
  registrationUrl: null,
  registrationType: "startline",
  feeStructure: "athlete",
  organiserId: "org-1",
  fromPrice: null,
};

describe("map-events helpers", () => {
  it("eventLngLat returns coordinates for valid numbers", () => {
    expect(eventLngLat({ ...baseEvent, latitude: -37.8, longitude: 144.9 })).toEqual({
      lat: -37.8,
      lng: 144.9,
    });
  });

  it("eventLngLat returns null for missing coordinates", () => {
    expect(eventLngLat(baseEvent)).toBeNull();
    expect(eventLngLat({ ...baseEvent, latitude: null, longitude: 144.9 })).toBeNull();
  });

  it("hasCoordinates and filterMapEvents exclude events without coords", () => {
    const withCoords = { ...baseEvent, id: "2", latitude: -33.8, longitude: 151.2 };
    expect(hasCoordinates(withCoords)).toBe(true);
    expect(hasCoordinates(baseEvent)).toBe(false);
    expect(filterMapEvents([baseEvent, withCoords])).toEqual([withCoords]);
  });
});
