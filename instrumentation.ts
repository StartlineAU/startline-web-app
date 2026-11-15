import type { Instrumentation } from "next";

export function register() {
  // Nothing to start: error reporting writes to the log and needs no client.
}

/**
 * Next.js calls this for every error a render, route handler, server action or
 * middleware throws without handling. Errors a route catches and turns into a
 * response never reach it, so it does not double count them.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { reportError, toErrorReport } = await import("@/lib/error-reporting");
  reportError(
    toErrorReport(error, {
      source: "server",
      path: request.path,
      method: request.method,
      kind: `${context.routerKind}:${context.routeType}`,
    }),
  );
};
