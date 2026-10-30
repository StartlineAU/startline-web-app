import { describe, expect, it } from "vitest";
import { buildResultsTemplateCsv, RESULTS_TEMPLATE_HEADERS } from "@/lib/results-template";
import { parseCsvTable } from "@/lib/registration-csv";

describe("results template", () => {
  it("puts email, time, and placement next to each other", () => {
    const header = [...RESULTS_TEMPLATE_HEADERS];
    const email = header.indexOf("email");
    expect(header.slice(email, email + 3)).toEqual(["email", "time", "placement"]);
  });

  it("writes a flat header and one row per athlete", () => {
    const csv = buildResultsTemplateCsv([
      {
        registrationId: "reg-1",
        name: "Alex Turner",
        bib: "42",
        category: "Open",
        email: "alex@example.com",
        time: "41:05",
        placement: "8th / 512",
        distance: "10km",
        isPersonalBest: true,
        isTopResult: false,
      },
    ]);
    const { header, rows } = parseCsvTable(csv);

    expect(header).toEqual([...RESULTS_TEMPLATE_HEADERS].map((value) => value.toLowerCase()));
    expect(rows).toHaveLength(1);
    expect(rows[0][4]).toBe("alex@example.com");
    expect(rows[0][5]).toBe("41:05");
    expect(rows[0][6]).toBe("8th / 512");
  });

  it("escapes commas and quotes", () => {
    const csv = buildResultsTemplateCsv([
      {
        registrationId: "reg-1",
        name: 'Alex "Ace" Turner',
        bib: "",
        category: "",
        email: "alex@example.com",
        time: "",
        placement: "8th, overall",
        distance: "",
        isPersonalBest: false,
        isTopResult: false,
      },
    ]);

    expect(csv).toContain('"Alex ""Ace"" Turner"');
    expect(csv).toContain('"8th, overall"');
  });
});
