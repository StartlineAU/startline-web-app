"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

// Replaces the root layout when the layout itself throws, so nothing from it
// (stylesheet, fonts) can be relied on. Inline styles only, kept to the
// design system's dark ink and signal green.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "global-boundary");
  }, [error]);

  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#141414",
          color: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
          padding: "0 16px",
        }}
      >
        <main style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 22 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a3a3a3", lineHeight: 1.5 }}>
            Startline hit an error. It has been reported. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "12px 20px",
              border: 0,
              borderRadius: 12,
              background: "#B3E153",
              color: "#141414",
              boxShadow: "2px 2px 0 #B3E153",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
