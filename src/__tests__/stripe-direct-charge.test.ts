import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevDirectCharge } from "@/lib/stripe-direct-charge";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDevDirectCharge", () => {
  it("is on only when asked for outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STRIPE_DEV_DIRECT_CHARGE", "true");
    expect(isDevDirectCharge()).toBe(true);
    vi.stubEnv("STRIPE_DEV_DIRECT_CHARGE", "");
    expect(isDevDirectCharge()).toBe(false);
  });

  it("never applies to a production build, whatever the variable says", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_DEV_DIRECT_CHARGE", "true");
    expect(isDevDirectCharge()).toBe(false);
  });
});
