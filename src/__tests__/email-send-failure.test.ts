import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const emailSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: emailSend };
    batch = { send: vi.fn() };
  },
}));

import { sendOrganiserInviteEmail } from "@/lib/email";
import { sendEntryConfirmation } from "@/lib/registration-confirm";
import { ERROR_MARKER } from "@/lib/error-reporting";

const event = {
  id: "evt_1",
  title: "Harbour 10k",
  eventDate: "2027-02-01",
  startTime: "07:00",
  startsAtUtc: new Date("2027-01-31T20:00:00Z"),
  endsAtUtc: new Date("2027-01-31T23:00:00Z"),
  feeStructure: "athlete",
  location: "Sydney",
} as unknown as Parameters<typeof sendEntryConfirmation>[0];

describe("single email sends", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    emailSend.mockReset();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.restoreAllMocks();
  });

  it("rejects when Resend answers with an error instead of throwing", async () => {
    emailSend.mockResolvedValue({ data: null, error: { name: "rate_limit_exceeded", message: "Too many requests" } });
    await expect(
      sendOrganiserInviteEmail("a@example.com", { organisationName: "Org", inviteUrl: "https://x", expiresInDays: 7 }),
    ).rejects.toThrow(/rate_limit_exceeded/);
  });

  it("resolves when Resend accepts the message", async () => {
    emailSend.mockResolvedValue({ data: { id: "em_1" }, error: null });
    await expect(
      sendOrganiserInviteEmail("a@example.com", { organisationName: "Org", inviteUrl: "https://x", expiresInDays: 7 }),
    ).resolves.toBeUndefined();
  });

  it("reports a refused entry confirmation to the error alarm without throwing", async () => {
    emailSend.mockResolvedValue({ data: null, error: { name: "validation_error", message: "bad address" } });
    await expect(
      sendEntryConfirmation(event, { registrationId: "reg-1", email: "a@example.com", waveLabel: null, priceCents: 5000, platformFeeCents: 200 }),
    ).resolves.toBeUndefined();
    const marked = errorSpy.mock.calls
      .map((args: unknown[]) => String(args[0]))
      .filter((line: string) => line.startsWith(`${ERROR_MARKER} `));
    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain("email:registration-confirmation");
  });
});
