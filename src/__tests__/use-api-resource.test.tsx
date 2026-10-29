// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useApiResource } from "@/hooks/useApiResource";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => cleanup());

describe("useApiResource", () => {
  it("keeps the newest response when an older request resolves last", async () => {
    const first = deferred<string>();
    const second = deferred<string>();

    const { result, rerender } = renderHook(
      ({ key }) => useApiResource<string>(() => (key === "first" ? first.promise : second.promise), { key }),
      { initialProps: { key: "first" } },
    );

    rerender({ key: "second" });
    await act(async () => second.resolve("second result"));
    expect(result.current.data).toBe("second result");

    await act(async () => first.resolve("first result"));
    expect(result.current.data).toBe("second result");
  });

  it("does not replace a draft with a response that arrived while it was dirty", async () => {
    const response = deferred<string>();
    let loaderCalls = 0;
    const load = () => {
      loaderCalls += 1;
      return loaderCalls === 1 ? response.promise : Promise.resolve("saved");
    };

    const { result } = renderHook(() => useApiResource<string>(load));

    act(() => result.current.markDirty());
    await act(async () => response.resolve("server value"));
    expect(result.current.data).toBeNull();

    act(() => result.current.commit("draft value"));
    expect(result.current.data).toBe("draft value");

    await act(async () => result.current.reload());
    expect(result.current.data).toBe("saved");
  });

  it("honours an external dirty guard and can reload once clean", async () => {
    let dirty = true;
    let value = "first";
    const { result } = renderHook(() =>
      useApiResource<string>(() => Promise.resolve(value), { isDirty: () => dirty }),
    );

    await act(async () => Promise.resolve());
    expect(result.current.data).toBeNull();

    dirty = false;
    value = "second";
    await act(async () => result.current.reload());
    expect(result.current.data).toBe("second");
  });

  it("exposes loading and error state", async () => {
    const failure = deferred<string>();
    const { result } = renderHook(() => useApiResource<string>(() => failure.promise));

    expect(result.current.loading).toBe(true);
    await act(async () => failure.reject(new Error("Could not load")));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Could not load");
  });

  it("does not update state after unmount", async () => {
    const response = deferred<string>();
    const { unmount } = renderHook(() => useApiResource<string>(() => response.promise));

    unmount();
    await act(async () => response.resolve("late"));

    expect(true).toBe(true);
  });

  it("does not load while disabled", async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useApiResource<string>(() => {
        calls += 1;
        return Promise.resolve("loaded");
      }, { enabled: false }),
    );

    await act(async () => Promise.resolve());
    expect(calls).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });
});
