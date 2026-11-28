// Per-type upload size caps, shared by the /api/upload route (enforcement)
// and the pickers that select files client-side (early feedback). Uploads in
// the event wizard are deferred to submit, so without the client-side check an
// oversized file is accepted silently and only fails five steps later.

// No video type: nothing uploads one, and a 200 MB allowance for any account
// was a free file host.
export type UploadType = "logo" | "cover" | "photo" | "avatar" | "document";

// Images are 25 MB: a full-resolution photographer's JPEG runs 12-20 MB, and
// 10 MB refused the event photos we commissioned ourselves (issue #594).
// Uploads go straight to S3, so this is not bounded by the Lambda payload, and
// visitors are served resized copies through next/image, not the original.
// Volume is held by MAX_GALLERY_PHOTOS instead.
export const UPLOAD_LIMITS: Record<UploadType, { bytes: number; label: string }> = {
  logo:     { bytes: 25 * 1024 * 1024,  label: "Image must be 25 MB or smaller."  },
  cover:    { bytes: 25 * 1024 * 1024,  label: "Image must be 25 MB or smaller."  },
  photo:    { bytes: 25 * 1024 * 1024,  label: "Image must be 25 MB or smaller."  },
  avatar:   { bytes: 25 * 1024 * 1024,  label: "Image must be 25 MB or smaller."  },
  document: { bytes: 15 * 1024 * 1024,  label: "PDF must be 15 MB or smaller."    },
};

// Photos per event gallery. The form stops at this many and the event schema
// refuses more, so the cap holds for API callers too.
export const MAX_GALLERY_PHOTOS = 8;

// Returns the rejection message for an oversized file, or null when the size
// is within the cap (or the type is unknown; the route's own type allowlist
// rejects those before size is ever considered).
export function uploadSizeError(type: string, size: number): string | null {
  const limit = UPLOAD_LIMITS[type as UploadType];
  if (!limit) return null;
  return size > limit.bytes ? limit.label : null;
}

// The MIME allowlist per upload type, and the extension each MIME maps to.
//
// Still photos only: no GIF anywhere on the site. matchesMagicBytes still
// sniffs GIF, and MIME_EXT still maps it, so re-allowing it stays a one-line
// change that is verified rather than waved through by the sniffer's default.
// Shared by /api/upload (which reads the bytes itself) and /api/upload/presign
// (which signs a direct-to-S3 POST). Keeping one copy matters: the presign
// route pins Content-Type as a signature condition, so a divergence here would
// let S3 reject an upload the route had already approved.
export const TYPE_MIMES: Record<UploadType, string[]> = {
  logo:     ["image/jpeg", "image/png", "image/webp"],
  cover:    ["image/jpeg", "image/png", "image/webp"],
  photo:    ["image/jpeg", "image/png", "image/webp"],
  avatar:   ["image/jpeg", "image/png", "image/webp"],
  document: ["application/pdf"],
};

export const MIME_EXT: Record<string, string> = {
  "image/jpeg":      "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "image/gif":       "gif",
  "video/mp4":       "mp4",
  "video/webm":      "webm",
  "video/quicktime": "mov",
  "video/avi":       "avi",
  "video/ogg":       "ogv",
  "application/pdf": "pdf",
};

export const UPLOAD_TYPES = Object.keys(TYPE_MIMES) as UploadType[];

export function isUploadType(value: unknown): value is UploadType {
  // Own keys only: `in` also accepts inherited names such as "constructor".
  return typeof value === "string" && Object.hasOwn(TYPE_MIMES, value);
}
