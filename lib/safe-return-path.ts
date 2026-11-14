/**
 * A same-site path to send someone back to after sign-in or a flow, or the
 * fallback.
 *
 * Checking `startsWith("/") && !startsWith("//")` is not enough: browsers treat
 * a backslash as a slash and drop tabs and newlines, so "/\evil.com" and
 * "/\t/evil.com" both leave the site. The value is parsed against a placeholder
 * origin and accepted only if it stays on that origin.
 */
const PLACEHOLDER_ORIGIN = "https://return-path.invalid";

export function safeReturnPath(
  value: unknown,
  { fallback = "/", blockedPrefixes = [] as string[] } = {},
): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Backslashes and control characters (including tab, CR and LF) are refused
  // outright rather than normalised.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  if (blockedPrefixes.some((prefix) => url.pathname.startsWith(prefix))) return fallback;
  return url.pathname + url.search + url.hash;
}
