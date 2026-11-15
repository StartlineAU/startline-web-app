"use client";

export type ClientErrorVia = "boundary" | "global-boundary" | "window-error" | "unhandled-rejection";

/** Per page load, so a render loop cannot send hundreds of reports. */
const MAX_REPORTS_PER_PAGE = 5;
let sent = 0;
const seen = new Set<string>();

/**
 * Send a browser error to /api/client-errors. Never throws: reporting an error
 * must not become a second one. keepalive lets the request finish while the
 * page navigates away.
 */
export function reportClientError(error: unknown, via: ClientErrorVia): void {
  try {
    if (typeof window === "undefined" || sent >= MAX_REPORTS_PER_PAGE) return;

    const err = error instanceof Error ? error : null;
    const message = (err?.message ?? (typeof error === "string" ? error : "Unknown error")).slice(0, 2_000);
    const key = `${via}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;

    const digest = (error as { digest?: unknown } | null)?.digest;
    const body = JSON.stringify({
      message,
      name: err?.name?.slice(0, 200),
      stack: err?.stack?.slice(0, 4_000),
      digest: typeof digest === "string" ? digest.slice(0, 200) : undefined,
      path: window.location.pathname.slice(0, 2_000),
      via,
    });

    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting is best-effort */
  }
}
