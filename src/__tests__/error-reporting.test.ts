import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => null) }));

import { rateLimit } from "@/lib/rate-limit";
import {
  ERROR_MARKER,
  formatErrorLine,
  stripQuery,
  toErrorReport,
} from "@/lib/error-reporting";
import { POST as clientErrors } from "@/app/api/client-errors/route";
import { onRequestError } from "@/instrumentation";

const rateLimitMock = rateLimit as ReturnType<typeof vi.fn>;

function post(body: string) {
  return new NextRequest("http://localhost:3000/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function loggedReports(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls
    .map((args: unknown[]) => String(args[0]))
    .filter((line: string) => line.startsWith(`${ERROR_MARKER} `))
    .map((line: string) => JSON.parse(line.slice(ERROR_MARKER.length + 1)));
}

describe("error reporting", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rateLimitMock.mockClear();
    rateLimitMock.mockImplementation(async () => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops the query string from reported paths", () => {
    expect(stripQuery("/auth/callback?code=secret&state=x")).toBe("/auth/callback");
    expect(stripQuery("/events#map")).toBe("/events");
    expect(stripQuery(undefined)).toBeUndefined();
  });

  it("bounds the message and stack and keeps the digest", () => {
    const err = Object.assign(new Error("x".repeat(5_000)), { digest: "abc123" });
    const report = toErrorReport(err, { source: "server", path: "/events?q=1" });
    expect(report.message.length).toBeLessThanOrEqual(1_001);
    expect(report.digest).toBe("abc123");
    expect(report.path).toBe("/events");
  });

  it("writes one marked JSON line the log filter can match", () => {
    const line = formatErrorLine({ source: "server", message: "boom" });
    expect(line.startsWith(`${ERROR_MARKER} {`)).toBe(true);
    expect(line).not.toContain("\n");
    expect(JSON.parse(line.slice(ERROR_MARKER.length + 1))).toMatchObject({ source: "server", message: "boom" });
  });

  it("reports unhandled server errors from Next.js", async () => {
    await onRequestError(
      new Error("render failed"),
      { path: "/events/abc?ref=mail", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/events/[id]", routeType: "render", renderSource: "react-server-components", revalidateReason: undefined },
    );
    const [report] = loggedReports(errorSpy);
    expect(report).toMatchObject({
      source: "server",
      message: "render failed",
      path: "/events/abc",
      method: "GET",
      kind: "App Router:render",
    });
  });

  it("logs a valid browser report and answers 204", async () => {
    const res = await clientErrors(
      post(JSON.stringify({ message: "x is undefined", via: "window-error", path: "/activity?tab=1" })),
    );
    expect(res.status).toBe(204);
    const [report] = loggedReports(errorSpy);
    expect(report).toMatchObject({ source: "client", via: "window-error", message: "x is undefined", path: "/activity" });
    expect(rateLimitMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ prefix: "client-errors" }));
  });

  it("refuses malformed or oversized browser reports without logging them", async () => {
    expect((await clientErrors(post("not json"))).status).toBe(400);
    expect((await clientErrors(post(JSON.stringify({ message: "m", via: "made-up" })))).status).toBe(400);
    expect((await clientErrors(post(JSON.stringify({ message: "m".repeat(9_000), via: "boundary" })))).status).toBe(400);
    expect(loggedReports(errorSpy)).toHaveLength(0);
  });

  it("stops at the rate limit before reading the body", async () => {
    const { NextResponse } = await import("next/server");
    rateLimitMock.mockImplementation(async () => NextResponse.json({}, { status: 429 }));
    const res = await clientErrors(post(JSON.stringify({ message: "m", via: "boundary" })));
    expect(res.status).toBe(429);
    expect(loggedReports(errorSpy)).toHaveLength(0);
  });
});
