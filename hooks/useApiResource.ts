"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ApiResourceOptions<T> {
  /** Disable automatic loading without unmounting the component. */
  enabled?: boolean;
  /** Value to show before the first response. */
  initialData?: T | null;
  /**
   * A draft guard. The hook calls this when a response arrives; if it returns
   * true, the response is discarded rather than replacing the caller's draft.
   * Prefer `markDirty` / `commit` unless the draft lives somewhere the hook
   * cannot see.
   */
  isDirty?: () => boolean;
}

export interface ApiResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Reload the resource. Silent reloads keep the current data visible. */
  reload: (options?: { silent?: boolean }) => Promise<void>;
  /** Replace data locally. This does not mark the resource dirty. */
  setData: (next: T | null | ((current: T | null) => T | null)) => void;
  /** Tell the hook that unsaved edits exist. */
  markDirty: () => void;
  /** A save succeeded: adopt the saved value and allow future reloads again. */
  commit: (saved?: T) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong.";
}

/**
 * Loads one API resource and keeps the newest response for the current
 * resource key. Responses can never arrive out of order and replace a newer
 * one, and a response cannot replace a draft the caller has marked dirty.
 */
export function useApiResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  options: ApiResourceOptions<T> & { key?: string | number | boolean | null } = {},
): ApiResource<T> {
  const { enabled = true, key = null, initialData = null } = options;

  const [data, setDataState] = useState<T | null>(initialData);
  const [loadingState, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const loadRef = useRef(load);
  const optionsRef = useRef(options);
  const latestRequest = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    loadRef.current = load;
    optionsRef.current = options;
  }, [load, options]);

  const setData = useCallback<ApiResource<T>["setData"]>((next) => {
    setDataState((current) =>
      typeof next === "function" ? (next as (value: T | null) => T | null)(current) : next,
    );
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const commit = useCallback((saved?: T) => {
    dirtyRef.current = false;
    if (saved !== undefined) setDataState(saved);
  }, []);

  const reload = useCallback<ApiResource<T>["reload"]>(async (reloadOptions) => {
    if (optionsRef.current.enabled === false) return;

    const request = ++latestRequest.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (!reloadOptions?.silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await loadRef.current(controller.signal);
      if (!mountedRef.current || request !== latestRequest.current) return;

      const currentOptions = optionsRef.current;
      if (dirtyRef.current || currentOptions.isDirty?.()) return;

      setDataState(response);
      setError(null);
    } catch (caught) {
      if (!mountedRef.current || request !== latestRequest.current || controller.signal.aborted) return;
      setError(errorMessage(caught));
    } finally {
      if (mountedRef.current && request === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Initial/keyed fetch: reload owns the loading state, as it does for
    // explicit refreshes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial resource load
    void reload();
    return () => controllerRef.current?.abort();
  }, [enabled, key, reload]);

  return { data, loading: enabled && loadingState, error, reload, setData, markDirty, commit };
}
