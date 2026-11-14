import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ geocodeLookup: vi.fn() }));
vi.mock("@/lib/geocode", () => ({ geocodeLookup: mocks.geocodeLookup }));

import { firstLocationError, locationFieldErrors, tidyLocationText } from "@/lib/event-location";
import { verifyEventLocation } from "@/lib/event-location-verify";

const REAL = { venue: "Albert Park", address: "Aughtie Dr, Albert Park VIC 3206", city: "Melbourne", state: "vic" };

// #530: a city of spaces reached review and showed as ", VIC".
describe("locationFieldErrors", () => {
  it("accepts a real location", () => {
    expect(locationFieldErrors(REAL, { required: true })).toEqual({});
  });

  it.each([
    "St Kilda", "O'Connor", "Kalgoorlie-Boulder", "Mt. Isa", "Wagga Wagga", "Tāmaki", "Ōtautahi",
  ])("accepts the place name %s", (city) => {
    expect(locationFieldErrors({ ...REAL, city }).city).toBeUndefined();
  });

  it.each([
    ["spaces", "   "],
    ["symbols", "!!!"],
    ["punctuation only", "-.'"],
    ["digits", "3000"],
    ["mixed junk", "Melb0urne"],
    ["a leading symbol", "#Melbourne"],
  ])("refuses a city of %s", (_, city) => {
    const errors = locationFieldErrors({ ...REAL, city }, { required: true });
    expect(errors.city).toBeDefined();
  });

  it.each([
    ["spaces", "      "],
    ["symbols", "!!!!!!"],
    ["digits only", "123456"],
    ["too short", "1 A"],
    ["emoji", "12 Smith St 🏃"],
  ])("refuses a street address of %s", (_, address) => {
    expect(locationFieldErrors({ ...REAL, address }, { required: true }).address).toBeDefined();
  });

  it("accepts unit and lot addresses", () => {
    expect(locationFieldErrors({ ...REAL, address: "Unit 4/12 Smith St, Fitzroy" }).address).toBeUndefined();
    expect(locationFieldErrors({ ...REAL, address: "Lot 7 (Gate B) Ocean Rd & Main St" }).address).toBeUndefined();
  });

  it("refuses a state that is not Australian", () => {
    expect(locationFieldErrors({ ...REAL, state: "ca" }).state).toBeDefined();
    expect(locationFieldErrors({ ...REAL, state: "VIC" }).state).toBeUndefined();
  });

  it("refuses a venue name with no letters, but it stays optional", () => {
    expect(locationFieldErrors({ ...REAL, venue: "!!!" }).venue).toBeDefined();
    expect(locationFieldErrors({ ...REAL, venue: "" }, { required: true }).venue).toBeUndefined();
  });

  it("only asks for empty fields when required", () => {
    expect(locationFieldErrors({})).toEqual({});
    expect(Object.keys(locationFieldErrors({}, { required: true })).sort()).toEqual(["address", "city", "state"]);
  });

  it("names the first problem", () => {
    expect(firstLocationError({ ...REAL, city: "   " }, { required: true })).toMatch(/city or suburb/i);
    expect(firstLocationError(REAL, { required: true })).toBeNull();
  });
});

describe("tidyLocationText", () => {
  it("collapses and trims spaces", () => {
    expect(tidyLocationText("  St   Kilda ")).toBe("St Kilda");
    expect(tidyLocationText(null)).toBe("");
  });
});

const found = (city: string, stateCode: string, district = "") => ({
  status: "found" as const,
  result: { label: "", city, district, stateCode, stateName: "", postalCode: "", country: "Australia", latitude: -37.8, longitude: 144.9 },
});

describe("verifyEventLocation", () => {
  beforeEach(() => mocks.geocodeLookup.mockReset());

  it("never asks the geocoder about junk", async () => {
    await expect(verifyEventLocation({ ...REAL, city: "   " })).resolves.toMatch(/city or suburb/i);
    expect(mocks.geocodeLookup).not.toHaveBeenCalled();
  });

  it("passes a place the geocoder finds in that state", async () => {
    mocks.geocodeLookup.mockResolvedValue(found("Melbourne", "vic"));
    await expect(verifyEventLocation(REAL)).resolves.toBeNull();
  });

  it("refuses a city the geocoder cannot find", async () => {
    mocks.geocodeLookup.mockResolvedValue({ status: "none" });
    await expect(verifyEventLocation({ ...REAL, city: "Fakeville" })).resolves.toMatch(/couldn't find Fakeville in VIC/);
  });

  it("refuses a city the geocoder only guesses at", async () => {
    // Geocoders answer with their nearest match rather than nothing.
    mocks.geocodeLookup.mockResolvedValue(found("Melbourne", "vic"));
    await expect(verifyEventLocation({ ...REAL, city: "Fakeville" })).resolves.toMatch(/couldn't find Fakeville/);
  });

  it("refuses a city in the wrong state", async () => {
    mocks.geocodeLookup.mockResolvedValue(found("Melbourne", "vic"));
    await expect(verifyEventLocation({ ...REAL, state: "nsw" })).resolves.toMatch(/in NSW/);
  });

  it("takes a suburb that geocodes as a district of its metro city", async () => {
    mocks.geocodeLookup.mockResolvedValue(found("Melbourne", "vic", "St Kilda"));
    await expect(verifyEventLocation({ ...REAL, city: "St Kilda" })).resolves.toBeNull();
  });

  it("refuses an address the geocoder cannot place in the state", async () => {
    mocks.geocodeLookup
      .mockResolvedValueOnce(found("Melbourne", "vic"))
      .mockResolvedValueOnce({ status: "none" });
    await expect(verifyEventLocation(REAL)).resolves.toMatch(/street address/);
  });

  it("falls back to the shape check when the geocoder is unavailable", async () => {
    mocks.geocodeLookup.mockResolvedValue({ status: "unavailable" });
    await expect(verifyEventLocation({ ...REAL, city: "Fakeville" })).resolves.toBeNull();
  });
});
