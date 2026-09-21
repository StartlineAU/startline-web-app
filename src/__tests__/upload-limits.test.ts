import { describe, it, expect } from "vitest";
import { UPLOAD_LIMITS, TYPE_MIMES, uploadSizeError } from "@/lib/upload-limits";

const MB = 1024 * 1024;

describe("uploadSizeError", () => {
  it("accepts a file exactly at the cap", () => {
    expect(uploadSizeError("document", 15 * MB)).toBeNull();
    expect(uploadSizeError("cover", 10 * MB)).toBeNull();
    expect(uploadSizeError("video", 200 * MB)).toBeNull();
  });

  it("rejects a file one byte over the cap with the type's message", () => {
    expect(uploadSizeError("document", 15 * MB + 1)).toBe("PDF must be 15 MB or smaller.");
    expect(uploadSizeError("cover", 10 * MB + 1)).toBe("Image must be 10 MB or smaller.");
    expect(uploadSizeError("video", 200 * MB + 1)).toBe("Video must be 200 MB or smaller.");
  });

  it("caps every allowlisted upload type", () => {
    for (const type of Object.keys(UPLOAD_LIMITS)) {
      expect(uploadSizeError(type, 5 * 1024 * MB)).not.toBeNull();
    }
  });

  it("defers unknown types to the route's own allowlist", () => {
    expect(uploadSizeError("archive", 5 * 1024 * MB)).toBeNull();
  });

  it("keeps image caps consistent across image types", () => {
    expect(UPLOAD_LIMITS.logo.bytes).toBe(UPLOAD_LIMITS.cover.bytes);
    expect(UPLOAD_LIMITS.photo.bytes).toBe(UPLOAD_LIMITS.cover.bytes);
    expect(UPLOAD_LIMITS.avatar.bytes).toBe(UPLOAD_LIMITS.cover.bytes);
  });
});

// No GIF anywhere on the site (#338). The sniffer still knows the signature,
// so re-allowing it would be verified rather than waved through by its
// default-true branch.
describe("image uploads", () => {
  it("takes still photos only, for every image type", () => {
    for (const type of ["logo", "cover", "photo", "merch", "avatar"] as const) {
      expect(TYPE_MIMES[type]).toEqual(["image/jpeg", "image/png", "image/webp"]);
    }
  });

  it("allows no GIF under any upload type", () => {
    for (const mimes of Object.values(TYPE_MIMES)) expect(mimes).not.toContain("image/gif");
  });
});

// Merchandise photos are their own type so the cap can be tighter than the
// gallery's (#338).
describe("merchandise photos", () => {
  it("caps a product photo at 5 MB", () => {
    expect(uploadSizeError("merch", 5 * MB)).toBeNull();
    expect(uploadSizeError("merch", 5 * MB + 1)).toBe("Photo must be 5 MB or smaller.");
  });

  it("is tighter than the gallery photo cap", () => {
    expect(UPLOAD_LIMITS.merch.bytes).toBeLessThan(UPLOAD_LIMITS.photo.bytes);
  });

  it("allows nothing the gallery photo type does not", () => {
    for (const mime of TYPE_MIMES.merch) expect(TYPE_MIMES.photo).toContain(mime);
  });
});
