import { describe, it, expect } from "vitest";
import { getEventCoords, CITY_COORDS, STATE_CENTERS } from "@/lib/australia-coords";

describe("CITY_COORDS", () => {
  it("includes major Australian cities", () => {
    expect(CITY_COORDS["sydney"]).toBeDefined();
    expect(CITY_COORDS["melbourne"]).toBeDefined();
    expect(CITY_COORDS["brisbane"]).toBeDefined();
    expect(CITY_COORDS["perth"]).toBeDefined();
    expect(CITY_COORDS["adelaide"]).toBeDefined();
    expect(CITY_COORDS["canberra"]).toBeDefined();
    expect(CITY_COORDS["hobart"]).toBeDefined();
    expect(CITY_COORDS["darwin"]).toBeDefined();
  });

  it("each city has lat/lng coordinates", () => {
    for (const [key, coords] of Object.entries(CITY_COORDS)) {
      expect(coords).toHaveLength(2);
      expect(coords[0]).toBeGreaterThanOrEqual(-44); // lat range
      expect(coords[0]).toBeLessThanOrEqual(-10);
      expect(coords[1]).toBeGreaterThanOrEqual(113); // lng range
      expect(coords[1]).toBeLessThanOrEqual(154);
    }
  });
});

describe("STATE_CENTERS", () => {
  it("includes all 8 states/territories", () => {
    expect(Object.keys(STATE_CENTERS)).toHaveLength(8);
    expect(STATE_CENTERS["nsw"]).toBeDefined();
    expect(STATE_CENTERS["vic"]).toBeDefined();
    expect(STATE_CENTERS["qld"]).toBeDefined();
    expect(STATE_CENTERS["wa"]).toBeDefined();
    expect(STATE_CENTERS["sa"]).toBeDefined();
    expect(STATE_CENTERS["tas"]).toBeDefined();
    expect(STATE_CENTERS["act"]).toBeDefined();
    expect(STATE_CENTERS["nt"]).toBeDefined();
  });
});

describe("getEventCoords", () => {
  it("returns coordinates for known cities", () => {
    const [lat, lng] = getEventCoords("Melbourne", "vic");
    expect(lat).toBeCloseTo(-37.81, 1);
    expect(lng).toBeCloseTo(144.96, 1);
  });

  it("handles case-insensitive city names", () => {
    const [lat, lng] = getEventCoords("SYDNEY", "nsw");
    expect(lat).toBeCloseTo(-33.87, 1);
    expect(lng).toBeCloseTo(151.21, 1);
  });

  it("falls back to state center for unknown cities", () => {
    const [lat, lng] = getEventCoords("Nowhere", "qld");
    expect(lat).toBeCloseTo(-23.0, 0);
    expect(lng).toBeCloseTo(144.0, 0);
  });

  it("falls back to Sydney for unknown state", () => {
    const [lat, lng] = getEventCoords("Nowhere", "zz");
    expect(lat).toBeCloseTo(-33.87, 1);
    expect(lng).toBeCloseTo(151.21, 1);
  });

  it("returns correct coordinates for Gold Coast", () => {
    const [lat, lng] = getEventCoords("Gold Coast", "qld");
    expect(lat).toBeCloseTo(-28.02, 1);
    expect(lng).toBeCloseTo(153.40, 1);
  });

  it("returns correct coordinates for London (placeholder)", () => {
    const [lat, lng] = getEventCoords("London", "nsw");
    // London not in CITY_COORDS, falls back to NSW center
    expect(lat).toBeCloseTo(-33.0, 0);
    expect(lng).toBeCloseTo(147.0, 0);
  });
});
