import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  class GeoPlacesClient {
    send = send;
  }
  class GeocodeCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  class AutocompleteCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  return { send, GeoPlacesClient, GeocodeCommand, AutocompleteCommand };
});

vi.mock("@aws-sdk/client-geo-places", () => ({
  GeoPlacesClient: mocks.GeoPlacesClient,
  GeocodeCommand: mocks.GeocodeCommand,
  AutocompleteCommand: mocks.AutocompleteCommand,
}));

import { resolvePlace } from "@/lib/geocode";

const place = (
  label: string,
  placeType: string,
  locality: string,
  state: string,
  position: [number, number],
) => ({
  PlaceType: placeType,
  Address: {
    Label: label,
    Locality: locality,
    Region: { Code: state, Name: state },
    PostalCode: "",
    Country: { Name: "Australia" },
  },
  Position: position,
});

describe("resolvePlace", () => {
  beforeEach(() => {
    mocks.send.mockReset();
  });

  it("returns one place when the name is unique", async () => {
    mocks.send.mockResolvedValueOnce({
      ResultItems: [place("Sydney, NSW 2000, Australia", "Locality", "Sydney", "NSW", [151.2, -33.86])],
    });

    const resolved = await resolvePlace("Sydney");

    expect(resolved.result?.city).toBe("Sydney");
    expect(resolved.choices).toEqual([]);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("offers one choice per state when a locality is ambiguous", async () => {
    mocks.send
      .mockResolvedValueOnce({
        ResultItems: [
          place("St Kilda, QLD 4671, Australia", "Locality", "St Kilda", "QLD", [151.9, -25.05]),
          place("St Kilda, SA 5110, Australia", "Locality", "St Kilda", "SA", [138.5, -34.73]),
        ],
      })
      .mockResolvedValueOnce({
        ResultItems: [
          place("St Kilda, QLD 4671, Australia", "Locality", "St Kilda", "QLD", [151.9, -25.05]),
          place("St Kilda, SA 5110, Australia", "Locality", "St Kilda", "SA", [138.5, -34.73]),
          // Autocomplete districts omit Address.Region; the label names VIC.
          {
            PlaceType: "District",
            Title: "Australia, VIC, 3182, St Kilda",
            Address: { Label: "St Kilda, Melbourne, VIC 3182, Australia", Locality: "Melbourne" },
          },
        ],
      });

    const resolved = await resolvePlace("St Kilda");

    expect(resolved.result).toBeNull();
    expect(resolved.choices.map((choice) => choice.stateCode)).toEqual(["qld", "sa", "vic"]);
    expect(resolved.choices[2].label).toContain("Melbourne");
  });

  it("keeps the first result for a street address with several matches", async () => {
    mocks.send.mockResolvedValueOnce({
      ResultItems: [
        place("1 Martin Pl, Sydney NSW 2000, Australia", "PointAddress", "Sydney", "NSW", [151.2, -33.86]),
        place("1 Martin Pl, Mortdale NSW 2223, Australia", "PointAddress", "Mortdale", "NSW", [151.0, -33.97]),
      ],
    });

    const resolved = await resolvePlace("1 Martin Place Sydney");

    expect(resolved.result?.label).toContain("Sydney NSW 2000");
    expect(resolved.choices).toEqual([]);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("returns no result when the lookup fails", async () => {
    mocks.send.mockRejectedValueOnce(new Error("AccessDenied"));

    await expect(resolvePlace("St Kilda")).resolves.toEqual({ result: null, choices: [] });
  });
});
