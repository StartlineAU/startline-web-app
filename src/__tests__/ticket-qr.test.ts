import { describe, expect, it } from "vitest";

import { parseTicketQrPayload, ticketQrPayload } from "@/lib/ticket-qr";

const TOKEN = "8f14e45f-ceea-4e7a-9f5f-8c1f0f1c3d4b";

describe("ticket QR payload", () => {
  it("round-trips the opaque ticket token", () => {
    expect(ticketQrPayload(TOKEN)).toBe(`SLT1:${TOKEN}`);
    expect(parseTicketQrPayload(`  SLT1:${TOKEN}  `)).toBe(TOKEN);
  });

  it.each([
    "",
    TOKEN,
    `SLT1:${TOKEN}:extra`,
    "SLT1:not-a-token",
    "https://startlineau.com/ticket/8f14e45f-ceea-4e7a-9f5f-8c1f0f1c3d4b",
    "SLT0:8f14e45f-ceea-4e7a-9f5f-8c1f0f1c3d4b",
  ])("rejects %j", (payload) => {
    expect(parseTicketQrPayload(payload)).toBeNull();
  });
});
