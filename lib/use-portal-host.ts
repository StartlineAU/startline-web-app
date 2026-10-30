"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * The host this page is served on, for building cross-portal links in client
 * components with lib/portal-domains.ts.
 *
 * Empty during server render and hydration, so the first paint uses the
 * relative (single-host) shape. React then re-renders with the real host
 * without a hydration mismatch. On production that switches the link to the
 * absolute portal URL.
 */
export function usePortalHost(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.host,
    () => "",
  );
}
