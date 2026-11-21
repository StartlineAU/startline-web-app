import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "@/lib/csv-cell";

describe("escapeCsvCell", () => {
  it.each(["=HYPERLINK(\"https://x.test\",\"Click\")", "+cmd", "-2+3", "@SUM(A1)", "\tTab", "\rReturn"])(
    "turns a formula-looking cell into text: %s",
    (value) => {
      const cell = escapeCsvCell(value);
      // Quoting may wrap it, but the content must start with the apostrophe.
      expect(cell.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("leaves plain numbers alone, including ones with leading space", () => {
    expect(escapeCsvCell("-5")).toBe("-5");
    expect(escapeCsvCell("+61")).toBe("+61");
    expect(escapeCsvCell("12.5")).toBe("12.5");
    expect(escapeCsvCell(" -5")).toBe(" -5");
    expect(escapeCsvCell(" +61")).toBe(" +61");
  });

  it.each([" =HYPERLINK(\"https://x.test\",\"Click\")", "\n=cmd", "\r\n+cmd"])(
    "neutralises a formula hiding behind whitespace: %j",
    (value) => {
      expect(escapeCsvCell(value).replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("still quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("=a,b")).toBe("\"'=a,b\"");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeCsvCell("Jordan Clarke")).toBe("Jordan Clarke");
  });
});
