import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { cognitoProviderName, type SocialProvider } from "./social-providers";

const region     = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
// Linking runs through its own app client, so the pre sign-up trigger can tell it
// apart from a sign-in (aws_cognito_user_pool_client.link in startline-infra).
const linkClientId = process.env.NEXT_PUBLIC_COGNITO_LINK_CLIENT_ID ?? "";

export const LINK_CALLBACK_PATH = "/auth/link/callback";

export const LINK_COOKIES = {
  state:    "startline_link_state",
  verifier: "startline_link_verifier",
  provider: "startline_link_provider",
  returnTo: "startline_link_return",
  grant:    "startline_link_grant",
} as const;

export const LINK_COOKIE_MAX_AGE = 10 * 60;

// Proof that the password and authenticator code were checked for this link. An
// account with an authenticator app is only linked back with this grant, and it
// is signed, so a cookie someone sets by hand cannot stand in for the check.
export function signLinkGrant(
  { state, sub, provider }: { state: string; sub: string; provider: SocialProvider },
  now = Date.now(),
): string | null {
  const key = process.env.LINK_GRANT_SECRET;
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({
    s: state,
    u: sub,
    p: provider,
    e: Math.floor(now / 1000) + LINK_COOKIE_MAX_AGE,
  })).toString("base64url");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}

export function verifyLinkGrant(
  token: string | undefined,
  expected: { state: string; sub: string; provider: SocialProvider },
  now = Date.now(),
): boolean {
  const key = process.env.LINK_GRANT_SECRET;
  if (!key || !token) return false;
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) return false;

  const expectedMac = Buffer.from(createHmac("sha256", key).update(payload).digest("base64url"));
  const actualMac = Buffer.from(mac);
  if (actualMac.length !== expectedMac.length || !timingSafeEqual(actualMac, expectedMac)) return false;

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  const expiresAt = claims.e;
  return claims.s === expected.state
    && claims.u === expected.sub
    && claims.p === expected.provider
    && typeof expiresAt === "number"
    && expiresAt * 1000 > now;
}

export function cognitoHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_COGNITO_DOMAIN?.trim();
  if (!raw) return null;
  const withoutProtocol = raw.replace(/^https?:\/\//, "");
  return withoutProtocol.replace(/\/+$/, "") || null;
}

export function linkCallbackUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${LINK_CALLBACK_PATH}`;
}

export function createLinkRequest(
  provider: SocialProvider,
  origin: string,
): { url: string; state: string; verifier: string } | null {
  const host = cognitoHost();
  if (!host || !linkClientId) return null;

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: linkClientId,
    redirect_uri: linkCallbackUrl(origin),
    scope: "openid email profile",
    identity_provider: cognitoProviderName(provider),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return {
    url: `https://${host}/oauth2/authorize?${params.toString()}`,
    state,
    verifier,
  };
}

export type CognitoTokens = {
  idToken: string;
  accessToken?: string;
};

// A public app client has no secret, so the code is redeemed with the PKCE
// verifier the browser kept in an httpOnly cookie.
export async function exchangeLinkCode({
  code,
  verifier,
  origin,
}: {
  code: string;
  verifier: string;
  origin: string;
}): Promise<CognitoTokens | null> {
  const host = cognitoHost();
  if (!host || !linkClientId) return null;

  const response = await fetch(`https://${host}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: linkClientId,
      code,
      redirect_uri: linkCallbackUrl(origin),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as
    | { id_token?: unknown; access_token?: unknown }
    | null;
  if (!body || typeof body.id_token !== "string") return null;

  return {
    idToken: body.id_token,
    accessToken: typeof body.access_token === "string" ? body.access_token : undefined,
  };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  if (!region || !userPoolId) return null;
  if (!jwks) {
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return jwks;
}

// The token comes from Cognito's token endpoint over HTTPS, but it is still
// verified as a token for this pool and client: the callback is a public URL,
// and a forged id_token must not decide which account gets linked.
export async function verifyCognitoIdToken(idToken: string): Promise<JWTPayload | null> {
  const set = getJwks();
  if (!set) return null;

  try {
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    const { payload } = await jwtVerify(idToken, set, {
      issuer,
      audience: linkClientId,
    });
    return payload;
  } catch {
    return null;
  }
}
