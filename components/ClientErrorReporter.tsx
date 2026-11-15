"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

/**
 * Reports errors no React boundary sees: event handlers, timers and rejected
 * promises nobody awaited. Mounted once in the root layout.
 */
export default function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // Cross-origin scripts surface as a bare "Script error." with no detail.
      if (!event.error && event.message === "Script error.") return;
      reportClientError(event.error ?? event.message, "window-error");
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      reportClientError(event.reason, "unhandled-rejection");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
