import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const batchSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    batch = { send: batchSend };
    emails = { send: vi.fn() };
  },
}));

import { sendEmailBatch, sendEventChangedEmails } from "@/lib/email";

const email = { subject: "s", html: "<p>h</p>", text: "h" };

describe("sendEmailBatch", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    batchSend.mockReset();
    batchSend.mockResolvedValue({ data: {}, error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.restoreAllMocks();
  });

  it("sends 250 messages in three calls of at most 100", async () => {
    const messages = Array.from({ length: 250 }, (_, i) => ({ to: `a${i}@example.com`, email }));
    const sent = await sendEmailBatch(messages, "test");
    expect(sent).toBe(250);
    expect(batchSend.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50]);
  });

  it("keeps going after a failed chunk and counts only what was accepted", async () => {
    batchSend
      .mockResolvedValueOnce({ data: null, error: { message: "rate limited" } })
      .mockResolvedValueOnce({ data: {}, error: null });
    const messages = Array.from({ length: 150 }, (_, i) => ({ to: `a${i}@example.com`, email }));
    expect(await sendEmailBatch(messages, "test")).toBe(50);
    expect(batchSend).toHaveBeenCalledTimes(2);
  });

  it("sends nothing without an API key", async () => {
    delete process.env.RESEND_API_KEY;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendEmailBatch([{ to: "a@example.com", email }], "test")).toBe(0);
    expect(batchSend).not.toHaveBeenCalled();
  });

  it("renders a personalised message per entrant", async () => {
    await sendEventChangedEmails([
      { to: "harper@example.com", data: { athleteName: "Harper Jones", eventId: "e1", eventTitle: "Harbour 10K", organiserName: "Apex", changes: [] } },
      { to: "tom@example.com", data: { athleteName: "Tom Whitfield", eventId: "e1", eventTitle: "Harbour 10K", organiserName: "Apex", changes: [] } },
    ]);
    const sent = batchSend.mock.calls[0][0] as { to: string; html: string }[];
    expect(sent.map((m) => m.to)).toEqual(["harper@example.com", "tom@example.com"]);
    expect(sent[0].html).toContain("Hi Harper,");
    expect(sent[1].html).toContain("Hi Tom,");
  });
});
