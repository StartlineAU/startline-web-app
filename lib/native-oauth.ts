import { decodeJWT } from "aws-amplify/auth";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import type { SocialProvider } from "./social-providers";

/**
 * Google and Apple sign-in inside the mobile app (startline-mobile-app).
 *
 * In a browser, Amplify's signInWithRedirect sends the page to Cognito's hosted
 * endpoint and its OAuth listener finishes the job on /auth/callback. Neither
 * works in the app:
 *
 *  - Google refuses OAuth in embedded webviews (`disallowed_useragent`), so
 *    the hosted page has to run in the system browser (SFSafariViewController
 *    on iOS, Custom Tabs on Android).
 *  - The system browser returns to the app through its own URL scheme,
 *    com.startlineau.app://auth/callback. Amplify always swaps the code using
 *    a same-origin redirect URI, which would not match the one the code was
 *    issued for, so Cognito would refuse the swap.
 *
 * So the app runs the same authorization-code + PKCE flow itself: the
 * verifier and state stay in the webview, the hosted page opens in the system
 * browser, and when the app scheme comes back the code is swapped here and the
 * tokens are stored exactly as Amplify's own code-flow handler stores them
 * (cacheCognitoTokens). From there the existing /auth/callback page carries on
 * as it does on the web.
 *
 * The scheme is registered in the app's AndroidManifest.xml and Info.plist, and
 * in both Cognito app clients' callback URLs (startline-infra).
 */

export const NATIVE_REDIRECT_URI = "com.startlineau.app://auth/callback";

const COGNITO_PROVIDER: Record<SocialProvider, string> = {
  google: "Google",
  apple: "SignInWithApple",
};

const SCOPES = ["openid", "email", "profile", "aws.cognito.signin.user.admin"];

// localStorage rather than sessionStorage: Android may recreate the webview's
// activity while the system browser is in front, and session storage would
// not survive that.
const VERIFIER_KEY = "startline_native_oauth_verifier";
const STATE_KEY = "startline_native_oauth_state";

function cognitoDomain(): string {
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "";
  if (!domain) throw new Error("Social sign-in is not configured.");
  return domain.replace(/^https?:\/\//, "");
}

function clientId(): string {
  return process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** The hosted-UI address for one provider, with this flow's state and challenge. */
export function authorizeUrl(provider: SocialProvider, state: string, challenge: string): string {
  const params = new URLSearchParams({
    identity_provider: COGNITO_PROVIDER[provider],
    redirect_uri: NATIVE_REDIRECT_URI,
    response_type: "code",
    client_id: clientId(),
    scope: SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://${cognitoDomain()}/oauth2/authorize?${params.toString()}`;
}

/** Open Google or Apple in the system browser. The app scheme brings it back. */
export async function startNativeSocialSignIn(provider: SocialProvider): Promise<void> {
  const verifier = randomString(48);
  const state = randomString(24);
  const challenge = await pkceChallenge(verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: authorizeUrl(provider, state, challenge), presentationStyle: "popover" });
}

/**
 * The web path for an app-scheme callback, or null when the URL is not one.
 * com.startlineau.app://auth/callback?code=…&state=…
 *   → /auth/callback?native=1&code=…&state=…
 */
export function nativeCallbackPath(url: string): string | null {
  if (!url.startsWith(NATIVE_REDIRECT_URI)) return null;
  const query = url.slice(NATIVE_REDIRECT_URI.length).replace(/^[/?]+/, "");
  const params = new URLSearchParams(query);
  params.set("native", "1");
  return `/auth/callback?${params.toString()}`;
}

/**
 * Swap the code for tokens and store them where Amplify reads them, so
 * fetchAuthSession, the server (through the cookies) and token refresh all
 * behave as after a web sign-in. Throws on a state mismatch or a refused swap.
 */
export async function completeNativeSignIn(code: string, state: string): Promise<void> {
  const expectedState = localStorage.getItem(STATE_KEY);
  const verifier = localStorage.getItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  // A state that does not match is a forged or replayed callback.
  if (!verifier || !expectedState || expectedState !== state) {
    throw new Error("Sign-in state mismatch");
  }

  const res = await fetch(`https://${cognitoDomain()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId(),
      code,
      redirect_uri: NATIVE_REDIRECT_URI,
      code_verifier: verifier,
    }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string; id_token?: string; refresh_token?: string; error?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error ?? `Token exchange failed (${res.status})`);
  }

  // Mirrors Amplify's cacheCognitoTokens, which its own code flow uses.
  const accessToken = decodeJWT(body.access_token);
  const issuedAt = (accessToken.payload.iat ?? 0) * 1000;
  await cognitoUserPoolsTokenProvider.tokenOrchestrator.setTokens({
    tokens: {
      accessToken,
      idToken: body.id_token ? decodeJWT(body.id_token) : undefined,
      refreshToken: body.refresh_token,
      clockDrift: issuedAt > 0 ? issuedAt - Date.now() : 0,
      username: String(accessToken.payload.username ?? "username"),
    },
  });
}
