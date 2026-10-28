import { describe, it, expect } from "vitest";
import { isProductionHost } from "@/lib/site-host";

describe("isProductionHost", () => {
  it("accepts the apex domain and its www alias", () => {
    expect(isProductionHost("startlineau.com")).toBe(true);
    expect(isProductionHost("www.startlineau.com")).toBe(true);
  });

  it("ignores case and the port the Host header carries in dev", () => {
    expect(isProductionHost("StartlineAU.com")).toBe(true);
    expect(isProductionHost("startlineau.com:443")).toBe(true);
    expect(isProductionHost("www.startlineau.com:3000")).toBe(true);
  });

  it("rejects every other deployment", () => {
    expect(isProductionHost("localhost:3000")).toBe(false);
    expect(isProductionHost("d2abc123.amplifyapp.com")).toBe(false);
    expect(isProductionHost("staging.startlineau.com")).toBe(false);
  });

  it("rejects the other production portals, which do not show the waitlist", () => {
    expect(isProductionHost("organiser.startlineau.com")).toBe(false);
    expect(isProductionHost("admin.startlineau.com")).toBe(false);
  });

  it("is not fooled by a look-alike domain", () => {
    expect(isProductionHost("startlineau.com.evil.test")).toBe(false);
    expect(isProductionHost("notstartlineau.com")).toBe(false);
  });

  it("treats a missing host as not production", () => {
    expect(isProductionHost(undefined)).toBe(false);
    expect(isProductionHost(null)).toBe(false);
    expect(isProductionHost("")).toBe(false);
  });
});
