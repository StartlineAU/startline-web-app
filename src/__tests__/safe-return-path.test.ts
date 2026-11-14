import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/safe-return-path";

describe("safeReturnPath", () => {
  it("keeps a same-site path with its query and hash", () => {
    expect(safeReturnPath("/events/abc?tab=info#map")).toBe("/events/abc?tab=info#map");
  });

  it.each([
    "/\\evil.com",
    "/\\/evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "//evil.com",
    "https://evil.com",
    "evil.com",
    "",
    "/%0a/evil.com",
  ])("refuses an off-site or malformed value: %j", (value) => {
    const result = safeReturnPath(value);
    expect(result === "/" || result.startsWith("/%0a")).toBe(true);
    expect(new URL(result, "https://startlineau.com").origin).toBe("https://startlineau.com");
  });

  it("refuses non-strings", () => {
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath(42)).toBe("/");
  });

  it("applies blocked prefixes after normalising", () => {
    expect(safeReturnPath("/auth/callback", { blockedPrefixes: ["/auth/"] })).toBe("/");
    expect(safeReturnPath("/x/../auth/link", { blockedPrefixes: ["/auth/"] })).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeReturnPath("//evil.com", { fallback: "" })).toBe("");
  });
});
