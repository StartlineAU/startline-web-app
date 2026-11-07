import { Capacitor } from "@capacitor/core";

// The mobile app (StartlineAU/startline-mobile-app) is a Capacitor shell that
// loads this site. Everything native is driven from here, behind isNative(), so
// a browser never loads or runs any of it.

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return isNative() && Capacitor.getPlatform() === "ios";
}

export function isAndroid(): boolean {
  return isNative() && Capacitor.getPlatform() === "android";
}

export async function openExternal(url: string): Promise<void> {
  if (isNative()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// Production splits the portals across these hosts; the app may move between
// them. Any other environment serves all three portals from one host.
const PRODUCTION_HOSTS = ["startlineau.com", "organiser.startlineau.com", "admin.startlineau.com"];

/** True when a link stays inside the site the app is showing. */
export function isSameSite(url: URL, current: Location | URL = window.location): boolean {
  if (url.hostname === current.hostname) return true;
  return PRODUCTION_HOSTS.includes(url.hostname) && PRODUCTION_HOSTS.includes(current.hostname);
}

/**
 * Where an incoming app link should take the webview. A startlineau.com link
 * opened in the staging build lands on the same page in staging, so a tester
 * never ends up on production by tapping a link.
 */
export function appLinkTarget(url: URL, current: Location | URL = window.location): string {
  return isSameSite(url, current) ? url.href : `${current.origin}${url.pathname}${url.search}${url.hash}`;
}

let shellReady = false;

/**
 * One-time native setup, from the root layout. Hides the launch splash, styles
 * the status bar, wires Android's back button, and handles URLs that open the
 * app: the sign-in callback scheme and startlineau.com deep links.
 */
export async function setUpNativeShell(): Promise<void> {
  if (!isNative() || shellReady) return;
  shellReady = true;

  const [{ App }, { Browser }, { SplashScreen }, { StatusBar, Style }, { nativeCallbackPath }] =
    await Promise.all([
      import("@capacitor/app"),
      import("@capacitor/browser"),
      import("@capacitor/splash-screen"),
      import("@capacitor/status-bar"),
      import("./native-oauth"),
    ]);

  // Dark only (design/design.md): light text on the #141414 background.
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  if (isAndroid()) await StatusBar.setBackgroundColor({ color: "#141414" }).catch(() => {});
  await SplashScreen.hide().catch(() => {});

  // Android's back button walks the webview's history, and leaves the app
  // only from the first page rather than on every press.
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });

  await App.addListener("appUrlOpen", ({ url }) => {
    // Google or Apple finished in the system browser: close it and let
    // /auth/callback swap the code in the webview.
    const callback = nativeCallbackPath(url);
    if (callback) {
      void Browser.close().catch(() => {});
      window.location.assign(callback);
      return;
    }
    // A universal link or App Link (startlineau.com/events/..., /checkin/...).
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:") window.location.assign(appLinkTarget(parsed));
    } catch {
      // Not a URL we understand: stay where we are.
    }
  });
}
