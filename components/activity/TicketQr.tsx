"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

/**
 * The athlete's ticket QR. It is generated in the browser from the opaque
 * payload the ticket API returns, so the credential never appears as text.
 */
export function TicketQr({ payload, name }: { payload: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#141414", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <div
      data-testid="ticket-qr"
      className="flex shrink-0 flex-col items-center gap-1 rounded-xl bg-white p-2"
    >
      {src ? (
        <Image
          src={src}
          alt={`Ticket QR for ${name}`}
          width={148}
          height={148}
          unoptimized
          className="h-[148px] w-[148px]"
        />
      ) : (
        <div className="h-[148px] w-[148px] animate-pulse rounded bg-dark-light" />
      )}
      <span className="font-headline text-[9px] font-bold uppercase tracking-widest text-dark-darker">
        Scan at check-in
      </span>
    </div>
  );
}
