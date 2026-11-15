import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { reportError, toErrorReport } from "@/lib/error-reporting";

// Browser errors land here so they reach the same log, filter and alarm as
// server errors. Public by necessity, so the body is small and bounded and one
// address can only report so much: a page that throws in a loop must not turn
// into a flood of log lines.

const MAX_BODY_BYTES = 8_192;

const clientErrorSchema = z.object({
  message: z.string().max(2_000),
  name: z.string().max(200).optional(),
  stack: z.string().max(8_000).optional(),
  digest: z.string().max(200).optional(),
  path: z.string().max(2_000).optional(),
  via: z.enum(["boundary", "global-boundary", "window-error", "unhandled-rejection"]),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { prefix: "client-errors", limit: 20, windowSeconds: 60 });
  if (limited) return limited;

  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }
  const parsed = clientErrorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }

  const { message, name, stack, digest, path, via } = parsed.data;
  const error = Object.assign(new Error(message), { name: name ?? "Error", stack });
  reportError(toErrorReport(error, { source: "client", digest, path, via }));

  return new NextResponse(null, { status: 204 });
}
