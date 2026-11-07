"use client";

import { useEffect } from "react";
import { isNative, isSameSite, openExternal, setUpNativeShell } from "@/lib/capacitor";

/**
 * Mounted once in the root layout. In a browser it does nothing. Inside the
 * mobile app it sets up the native shell and keeps other sites out of the
 * webview: links that open a new tab, or that point anywhere other than this
 * site, open in the in-app system browser instead of replacing the app.
 */
export default function NativeLinkHandler() {
  useEffect(() => {
    if (!isNative()) return;

    void setUpNativeShell();

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as Element;
      const anchor = target.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = anchor?.getAttribute("href");
      if (!anchor || !href) return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      // mailto:, tel: and the like are the OS's to handle.
      if (url.protocol !== "http:" && url.protocol !== "https:") return;

      const offSite = !isSameSite(url);
      if (anchor.target === "_blank" || offSite) {
        e.preventDefault();
        void openExternal(url.toString());
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
