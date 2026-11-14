import { afterEach, describe, expect, it, vi } from "vitest";
import { externalUrl, isAllowedAssetUrl } from "@/lib/asset-url";

afterEach(() => vi.unstubAllEnvs());

describe("isAllowedAssetUrl", () => {
  it("accepts our uploads, same-site paths, stock images and empty", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_URL", "https://d1abc.cloudfront.net");
    expect(isAllowedAssetUrl("https://cdn.startlineau.com/uploads/org/photo/a.jpg")).toBe(true);
    expect(isAllowedAssetUrl("https://d1abc.cloudfront.net/uploads/org/photo/a.jpg")).toBe(true);
    expect(isAllowedAssetUrl("/uploads/photo/a.jpg")).toBe(true);
    expect(isAllowedAssetUrl("https://images.unsplash.com/photo-1?w=1200")).toBe(true);
    expect(isAllowedAssetUrl("")).toBe(true);
  });

  it("refuses other hosts, other paths, http and tricks", () => {
    expect(isAllowedAssetUrl("https://evil.example/pixel.gif")).toBe(false);
    expect(isAllowedAssetUrl("https://cdn.startlineau.com/pending/x.jpg")).toBe(false);
    expect(isAllowedAssetUrl("http://cdn.startlineau.com/uploads/a.jpg")).toBe(false);
    expect(isAllowedAssetUrl("//evil.example/a.jpg")).toBe(false);
    expect(isAllowedAssetUrl("/\\evil.example/a.jpg")).toBe(false);
    expect(isAllowedAssetUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedAssetUrl("https://user:pw@cdn.startlineau.com/uploads/a.jpg")).toBe(false);
  });

  it("does not take stock images for documents", () => {
    expect(isAllowedAssetUrl("https://images.unsplash.com/a.pdf", { allowStock: false })).toBe(false);
  });
});

describe("externalUrl", () => {
  it("accepts http(s) only", () => {
    expect(externalUrl().safeParse("https://example.com/reg").success).toBe(true);
    expect(externalUrl().safeParse("javascript:alert(1)").success).toBe(false);
    expect(externalUrl().safeParse("data:text/html,x").success).toBe(false);
  });
});
