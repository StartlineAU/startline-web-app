import { describe, expect, it } from "vitest";
import { tidyPlaceLabel } from "@/lib/place-label";

describe("tidyPlaceLabel", () => {
  it("shortens the formal country name to Australia", () => {
    expect(tidyPlaceLabel("12 Huron Rd, Craigieburn VIC 3064, Commonwealth of Australia"))
      .toBe("12 Huron Rd, Craigieburn VIC 3064, Australia");
  });

  it("leaves labels without it alone", () => {
    expect(tidyPlaceLabel("St Kilda, Melbourne, VIC 3182, Australia"))
      .toBe("St Kilda, Melbourne, VIC 3182, Australia");
    expect(tidyPlaceLabel("")).toBe("");
  });
});
