import { describe, it, expect } from "vitest";
import { isAllowedImageUrl } from "@/lib/image-urls";
import { sanitizeMerchandiseItem } from "@/lib/merchandise";
import { sanitizeAddOnInput } from "@/lib/add-ons";

// next/image throws while rendering when a host is not in remotePatterns, so a
// stored URL from anywhere else takes out a whole page rather than one picture.
describe("isAllowedImageUrl", () => {
  it("accepts what our own uploads produce", () => {
    expect(isAllowedImageUrl("/uploads/merch/abc.png")).toBe(true);
    expect(isAllowedImageUrl("https://cdn.startlineau.com/uploads/merch/abc.png")).toBe(true);
    expect(isAllowedImageUrl("https://d123.cloudfront.net/uploads/merch/abc.png")).toBe(true);
    expect(isAllowedImageUrl("https://startline-uploads.s3.ap-southeast-2.amazonaws.com/uploads/a.png")).toBe(true);
    expect(isAllowedImageUrl("https://images.unsplash.com/photo-1?w=400")).toBe(true);
  });

  it("refuses anywhere else", () => {
    expect(isAllowedImageUrl("https://evil.test/x.png")).toBe(false);
    expect(isAllowedImageUrl("http://cdn.startlineau.com/uploads/a.png")).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isAllowedImageUrl("")).toBe(false);
  });

  // "//host/x.png" is not same-origin, whatever its leading slash suggests.
  it("refuses a protocol-relative URL", () => {
    expect(isAllowedImageUrl("//evil.test/x.png")).toBe(false);
  });

  it("refuses a host that merely ends with an allowed one", () => {
    expect(isAllowedImageUrl("https://cdn.startlineau.com.evil.test/x.png")).toBe(false);
  });
});

const item = (imageUrl: string) => ({
  name: "Club tee",
  description: null,
  priceCents: 3500,
  imageUrl,
  optionLabel: "Size",
  options: ["M"],
});

describe("write routes refuse an off-site photo", () => {
  it("on profile merchandise", () => {
    expect(sanitizeMerchandiseItem(item("https://evil.test/x.png"))).toEqual({
      error: 'The photo for "Club tee" must be one you uploaded.',
    });
    expect("error" in sanitizeMerchandiseItem(item("/uploads/merch/a.png"))).toBe(false);
  });

  it("on event add-ons", () => {
    const addOn = { ...item("https://evil.test/x.png"), variants: [{ label: "M", stock: 1 }] };
    expect(sanitizeAddOnInput([addOn])).toEqual({
      error: 'The photo for "Club tee" must be one you uploaded.',
    });
  });
});
