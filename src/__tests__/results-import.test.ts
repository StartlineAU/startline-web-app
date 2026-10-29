import { describe, expect, it } from "vitest";
import { parseDelimitedRows } from "@/lib/registration-csv";
import { buildResultChange, parseResultsTable } from "@/lib/results-import";

describe("parseDelimitedRows", () => {
  it("reads comma-separated CSV", () => {
    expect(parseDelimitedRows("email,time,placement\nalex@example.com,41:05,8th")).toEqual([
      ["email", "time", "placement"],
      ["alex@example.com", "41:05", "8th"],
    ]);
  });

  it("reads the tab-separated text produced by spreadsheet copy", () => {
    expect(parseDelimitedRows("email\ttime\tplacement\nalex@example.com\t41:05\t8th")).toEqual([
      ["email", "time", "placement"],
      ["alex@example.com", "41:05", "8th"],
    ]);
  });

  it("honours quoted fields", () => {
    expect(parseDelimitedRows('email,time,placement\n"alex,team@example.com",41:05,"8th, overall"')).toEqual([
      ["email", "time", "placement"],
      ["alex,team@example.com", "41:05", "8th, overall"],
    ]);
  });
});

describe("parseResultsTable", () => {
  it("uses the required columns and ignores section headings", () => {
    const table = parseResultsTable([
      ["Wave A"],
      ["Email", "Result time", "Result placement"],
      ["Alex@Example.com", "41:05", "8th / 512"],
      ["Wave B"],
      ["bree@example.com", "42:10", "3rd / 12"],
    ]);

    expect(table.error).toBeUndefined();
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toMatchObject({
      sourceRow: 3,
      email: "alex@example.com",
      time: "41:05",
      placement: "8th / 512",
    });
    expect(table.rows[1]).toMatchObject({
      sourceRow: 5,
      email: "bree@example.com",
      time: "42:10",
      placement: "3rd / 12",
    });
  });

  it("matches Startline's flat results template headers", () => {
    const table = parseResultsTable([
      ["registrationId", "name", "bib", "category", "email", "time", "placement", "distance", "personalBest", "topResult"],
      ["reg-1", "Alex Turner", "42", "Open", "alex@example.com", "41:05", "8th", "10km", "TRUE", "FALSE"],
    ]);

    expect(table.rows[0]).toMatchObject({
      registrationId: "reg-1",
      email: "alex@example.com",
      time: "41:05",
      placement: "8th",
      distance: "10km",
      isPersonalBest: true,
      isTopResult: false,
    });
  });

  it("treats blank result cells as absent so saved values can be kept", () => {
    const table = parseResultsTable([
      ["registrationId", "email", "time", "placement"],
      ["reg-1", "alex@example.com", "", "8th"],
    ]);

    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].time).toBeUndefined();
    expect(table.rows[0].placement).toBe("8th");
  });

  it("converts Excel duration values into readable race times", () => {
    const table = parseResultsTable([
      ["email", "time"],
      ["alex@example.com", 2465 / 86_400],
      ["bree@example.com", new Date(Date.UTC(1899, 11, 30, 1, 8, 22))],
    ]);

    expect(table.rows.map((row) => row.time)).toEqual(["41:05", "1:08:22"]);
  });

  it("flags an unreadable time instead of dropping the row", () => {
    const table = parseResultsTable([
      ["email", "time"],
      ["alex@example.com", "banana"],
    ]);

    expect(table.rows[0].error).toMatch(/not readable/i);
  });

  it("reports when no match column exists", () => {
    const table = parseResultsTable([
      ["name", "time"],
      ["Alex Turner", "41:05"],
    ]);

    expect(table.rows).toEqual([]);
    expect(table.error).toMatch(/email or registration ID/i);
  });

  it("reports when no result column exists", () => {
    const table = parseResultsTable([
      ["email", "name"],
      ["alex@example.com", "Alex Turner"],
    ]);

    expect(table.rows).toEqual([]);
    expect(table.error).toMatch(/at least one result column/i);
  });
});

describe("buildResultChange", () => {
  const saved = {
    resultDistance: "10km",
    resultTime: "41:05",
    resultPlacement: "8th",
    isPersonalBest: true,
    isTopResult: false,
  };

  it("omits unchanged fields so a blank import cell keeps the saved value", () => {
    const change = buildResultChange("reg-1", saved, {
      distance: "10km",
      time: "42:10",
      placement: "8th",
      isPersonalBest: true,
      isTopResult: false,
    });

    expect(change).toEqual({ registrationId: "reg-1", resultTime: "42:10" });
  });

  it("sends null only when the organiser clears a field", () => {
    const change = buildResultChange("reg-1", saved, {
      distance: "10km",
      time: "",
      placement: "8th",
      isPersonalBest: true,
      isTopResult: false,
    });

    expect(change).toEqual({ registrationId: "reg-1", resultTime: null });
  });

  it("returns null when nothing changed", () => {
    expect(buildResultChange("reg-1", saved, {
      distance: "10km",
      time: "41:05",
      placement: "8th",
      isPersonalBest: true,
      isTopResult: false,
    })).toBeNull();
  });
});
