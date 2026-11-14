import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ paymentIntents: { retrieve: mocks.retrieve, update: mocks.update } }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => null }));

import { POST } from "@/app/api/checkout/accept-terms/route";

const SECRET = "pi_abc_secret_xyz";

function post(body: unknown) {
  return POST(new NextRequest("http://localhost/api/checkout/accept-terms", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.retrieve.mockResolvedValue({
    id: "pi_abc",
    client_secret: SECRET,
    status: "requires_payment_method",
    metadata: { eventId: "evt-1" },
  });
  mocks.update.mockResolvedValue({});
});

describe("POST /api/checkout/accept-terms", () => {
  it("stamps the acceptance on the PaymentIntent the secret belongs to", async () => {
    const res = await post({ clientSecret: SECRET });
    expect(res.status).toBe(200);
    expect(mocks.retrieve).toHaveBeenCalledWith("pi_abc");
    expect(mocks.update).toHaveBeenCalledWith("pi_abc", {
      metadata: { termsAcceptedAt: expect.any(String) },
    });
  });

  it("refuses a secret that does not match the PaymentIntent", async () => {
    const res = await post({ clientSecret: "pi_abc_secret_wrong" });
    expect(res.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses something that is not a client secret", async () => {
    const res = await post({ clientSecret: "pi_abc" });
    expect(res.status).toBe(400);
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("does not change a payment that already went through", async () => {
    mocks.retrieve.mockResolvedValue({ id: "pi_abc", client_secret: SECRET, status: "succeeded", metadata: { eventId: "evt-1" } });
    const res = await post({ clientSecret: SECRET });
    expect(res.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not touch a PaymentIntent checkout did not create", async () => {
    mocks.retrieve.mockResolvedValue({ id: "pi_abc", client_secret: SECRET, status: "requires_payment_method", metadata: {} });
    const res = await post({ clientSecret: SECRET });
    expect(res.status).toBe(409);
  });
});
