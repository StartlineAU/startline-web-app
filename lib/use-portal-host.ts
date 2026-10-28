"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * The host this page is served on, for building cross-origin links and for
 * content that only exists on one deployment.
 *
 * Empty during server render and hydration, so the first paint uses the
 * single-host shape. React then re-renders with the real host without a
 * hydration mismatch.
 */
export function usePortalHost(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.host,
    () => "",
  );
}
