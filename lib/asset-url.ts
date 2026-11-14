import { z } from "zod";

/**
 * Image and PDF URLs stored on listings and profiles.
 *
 * These were any string, so a listing could show an image from anywhere (a
 * tracking pixel on every view) or link "event information" to a PDF on any
 * site. Accepted now:
 *
 *   - our own uploads: the CDN or bucket, under /uploads/
 *   - same-site paths ("/uploads/…" from local dev, "/images/…" seed assets)
 *   - images.unsplash.com, which the seed data uses
 *   - "" or null, meaning none
 */
function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function uploadHosts(): Set<string> {
  const bucket = process.env.AWS_S3_BUCKET || process.env.UPLOADS_BUCKET || "";
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION || "ap-southeast-2";
  return new Set(
    [
      "cdn.startlineau.com",
      hostOf(process.env.NEXT_PUBLIC_CDN_URL),
      hostOf(process.env.CDN_URL),
      bucket ? `${bucket}.s3.${region}.amazonaws.com` : null,
      bucket ? `${bucket}.s3.amazonaws.com` : null,
    ].filter((host): host is string => Boolean(host)),
  );
}

const STOCK_IMAGE_HOSTS = new Set(["images.unsplash.com"]);

export function isAllowedAssetUrl(value: string, { allowStock = true } = {}): boolean {
  if (value === "") return true;
  if (value.startsWith("/")) {
    // Same-site path, not protocol-relative, no backslash tricks.
    return !value.startsWith("//") && !value.includes("\\");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (allowStock && STOCK_IMAGE_HOSTS.has(url.hostname)) return true;
  return uploadHosts().has(url.hostname) && url.pathname.startsWith("/uploads/");
}

const MESSAGE = "Use an image or file uploaded to Startline.";

export const assetUrl = (max = 3000) =>
  z.string().max(max).refine((value) => isAllowedAssetUrl(value), { message: MESSAGE });

export const documentUrl = (max = 2000) =>
  z.string().max(max).refine((value) => isAllowedAssetUrl(value, { allowStock: false }), { message: MESSAGE });

/** An external registration page: an absolute http(s) URL, nothing else. */
export const externalUrl = (max = 2000) =>
  z.string().max(max).refine((value) => {
    if (value === "") return true;
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
    } catch {
      return false;
    }
  }, { message: "Enter a full web address starting with https://." });
