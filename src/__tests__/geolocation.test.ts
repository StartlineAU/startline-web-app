import { describe, expect, it } from "vitest";
import { locationErrorMessage } from "@/lib/geolocation";

describe("locationErrorMessage", () => {
  it("explains a denied permission", () => {
    expect(locationErrorMessage(1)).toMatch(/location access was denied/i);
    expect(locationErrorMessage(1)).toMatch(/enter a city or suburb/i);
  });

  it("explains an unavailable position", () => {
    expect(locationErrorMessage(2)).toMatch(/unavailable/i);
  });

  it("explains a timeout", () => {
    expect(locationErrorMessage(3)).toMatch(/took too long/i);
  });

  it("covers a browser without geolocation", () => {
    expect(locationErrorMessage()).toMatch(/could not find your location/i);
  });
});
