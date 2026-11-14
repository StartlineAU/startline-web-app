import { describe, expect, it } from "vitest";
import { botCheckAppliesTo } from "@/lib/bot-check-hosts";

describe("botCheckAppliesTo", () => {
  it("covers the apex and every startlineau.com subdomain, which all serve /api/*", () => {
    for (const host of ["startlineau.com", "www.startlineau.com", "organiser.startlineau.com", "admin.startlineau.com", "ADMIN.startlineau.com."]) {
      expect(botCheckAppliesTo(host, "https://main.d1.amplifyapp.com"), host).toBe(true);
    }
  });

  it("covers every host of the production deployment, including its Amplify default domain", () => {
    expect(botCheckAppliesTo("prod.d1abc.amplifyapp.com", "https://startlineau.com")).toBe(true);
  });

  it("stays open on staging, previews and local dev, where the widget cannot issue a token", () => {
    expect(botCheckAppliesTo("main.d1abc.amplifyapp.com", "https://main.d1abc.amplifyapp.com")).toBe(false);
    expect(botCheckAppliesTo("localhost", "http://localhost:3000")).toBe(false);
    expect(botCheckAppliesTo("pr-12.d1abc.amplifyapp.com", undefined)).toBe(false);
  });

  it("is not fooled by a lookalike domain", () => {
    expect(botCheckAppliesTo("startlineau.com.evil.test", undefined)).toBe(false);
    expect(botCheckAppliesTo("notstartlineau.com", undefined)).toBe(false);
  });
});
