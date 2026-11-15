/**
 * One place every unhandled error is reported, server and browser alike.
 *
 * Each report is a single line on stderr: ERROR_MARKER, `env=<env>`, then JSON.
 * Amplify ships the server's output to CloudWatch, so a metric filter on the
 * marker counts errors and an alarm on that metric is the alert. Keeping the
 * shape here, rather than in each caller, is what lets one filter match all
 * of them.
 *
 * No third-party tracker is wired in yet. When one is, it hooks in here and
 * nothing else changes.
 */

export const ERROR_MARKER = "STARTLINE_ERROR";

export type ErrorSource = "server" | "client";

export interface ErrorReport {
  source: ErrorSource;
  message: string;
  name?: string;
  stack?: string;
  /** Next.js error digest, which links a browser boundary to its server log. */
  digest?: string;
  /** Route or page the error happened on, without the query string. */
  path?: string;
  method?: string;
  /** What Next.js was doing: render, route handler, middleware, action. */
  kind?: string;
  /** Browser-only: how the error surfaced (boundary, window.onerror, ...). */
  via?: string;
}

const MAX_MESSAGE = 1_000;
const MAX_STACK = 4_000;

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Drop the query string: it can carry tokens, emails or search terms. */
export function stripQuery(path: unknown): string | undefined {
  if (typeof path !== "string" || path.length === 0) return undefined;
  return clip(path.split(/[?#]/)[0], 300);
}

/** Normalise anything thrown into a bounded report. */
export function toErrorReport(
  error: unknown,
  context: Omit<ErrorReport, "message" | "name" | "stack">,
): ErrorReport {
  const err = error instanceof Error ? error : null;
  const message = err?.message ?? (typeof error === "string" ? error : "Unknown error");
  const digest = (error as { digest?: unknown } | null)?.digest;
  return {
    ...context,
    path: stripQuery(context.path),
    message: clip(message, MAX_MESSAGE) ?? "Unknown error",
    name: clip(err?.name, 100),
    stack: clip(err?.stack, MAX_STACK),
    digest: context.digest ?? (typeof digest === "string" ? clip(digest, 100) : undefined),
  };
}

/**
 * The line written to the log: `STARTLINE_ERROR env=<env> {json}`. The
 * environment is a plain token rather than only a JSON field because a
 * CloudWatch filter matches `"STARTLINE_ERROR env=prod"` exactly, while
 * escaped quotes inside a pattern do not match reliably.
 */
export function formatErrorLine(report: ErrorReport): string {
  const env = (process.env.ENV ?? process.env.NODE_ENV ?? "unknown").replace(/\s+/g, "-");
  return `${ERROR_MARKER} env=${env} ${JSON.stringify({ ...report, env })}`;
}

export function reportError(report: ErrorReport): void {
  console.error(formatErrorLine(report));
}
