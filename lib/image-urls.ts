/**
 * Which image URLs may be stored against a record.
 *
 * `next/image` throws when asked for a host that is not in `remotePatterns`,
 * and it throws while rendering the page, so one bad URL takes out the whole
 * page rather than one picture. Uploads only ever produce the shapes below, so
 * anything else reaching a write route came from a hand-made request and is
 * refused there instead of breaking a page later (#338).
 *
 * Keep the host list in step with `images.remotePatterns` in `next.config.ts`.
 */

const ALLOWED_HOSTS: RegExp[] = [
  // Uploads: the CDN, the CloudFront distribution behind it, or the bucket.
  /^cdn\.startlineau\.com$/,
  /^[a-z0-9-]+\.cloudfront\.net$/i,
  /^[a-z0-9.-]+\.s3\.ap-southeast-2\.amazonaws\.com$/i,
  // Seed and demo imagery.
  /^images\.unsplash\.com$/,
];

/**
 * True for a URL the app itself produced: a same-origin path (local dev's
 * proxy mode writes `/uploads/...`), or https on an allowed host.
 */
export function isAllowedImageUrl(value: string): boolean {
  const url = value.trim();
  if (!url) return false;

  // A protocol-relative URL ("//evil.test/x.png") is not same-origin.
  if (url.startsWith("//")) return false;
  if (url.startsWith("/")) return true;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" && parsed.hostname === "localhost") return true;
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some((host) => host.test(parsed.hostname));
  } catch {
    return false;
  }
}
