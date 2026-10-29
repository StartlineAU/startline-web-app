import { afterEach, describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { buildCheckInQrPdf, checkInQrPdfFilename } from "@/lib/check-in-qr-pdf";
import { checkInQrImageFilename } from "@/lib/check-in-qr-image";
import { checkInUrl } from "@/lib/check-in-qr";

describe("checkInUrl", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("builds the public athlete check-in link without a double slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.startlineau.com/";
    expect(checkInUrl("event-1", "code-1")).toBe(
      "https://staging.startlineau.com/checkin/event-1/code-1",
    );
  });

  it("falls back to the production site", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(checkInUrl("event-1", "code-1")).toBe(
      "https://startlineau.com/checkin/event-1/code-1",
    );
  });
});

describe("check-in QR filenames", () => {
  it("slugifies the event title for each download", () => {
    expect(checkInQrPdfFilename("Apex Bay Run 2026")).toBe(
      "apex-bay-run-2026-check-in-qr.pdf",
    );
    expect(checkInQrImageFilename("Apex Bay Run 2026")).toBe(
      "apex-bay-run-2026-check-in-qr.png",
    );
  });

  it("falls back to a usable name for punctuation-only titles", () => {
    expect(checkInQrImageFilename("!!!")).toBe("event-check-in-qr.png");
  });
});

describe("buildCheckInQrPdf", () => {
  it("renders a PDF containing the event details and QR", async () => {
    const qrDataUrl = await QRCode.toDataURL("https://startlineau.com/checkin/e/c", {
      margin: 1,
      width: 256,
    });

    const pdf = await buildCheckInQrPdf({
      eventTitle: "Apex Bay Run 2026",
      organiserName: "Apex Endurance Events",
      eventDate: "2026-03-22",
      startTime: "07:00",
      endTime: "11:00",
      venue: "Albert Park Lake",
      city: "Melbourne",
      state: "vic",
      qrDataUrl,
    });

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(5_000);
  });
});
