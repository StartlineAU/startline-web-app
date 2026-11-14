"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QR code for an authenticator-app setup URI, drawn in the browser.
 *
 * The `otpauth://` URI contains the TOTP shared secret, so it must never be
 * sent to a QR-rendering service or put in any URL that leaves the page.
 */
export default function TotpQrCode({ uri, className }: { uri: string; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(uri, { width: 384, margin: 1 })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [uri]);

  if (!dataUrl) {
    return <div className={className} aria-hidden="true" />;
  }

  // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimise
  return <img src={dataUrl} alt="Authenticator app QR code" width={192} height={192} className={className} />;
}
