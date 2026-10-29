import { createHash, randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { cognitoProviderName, type SocialProvider } from "./social-providers";

const region     = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";

export const LINK_CALLBACK_PATH = "/auth/link/callback";

export const LINK_COOKIES = {
  state:    "startline_link_state",
  verifier: "startline_link_verifier",
  provider: "startline_link_provider",
  returnTo: "startline_link_return",
} as const;

export const LINK_COOKIE_MAX_AGE = 10 * 60;

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
  if (!host || !clientId) return null;

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
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
  if (!host || !clientId) return null;

  const response = await fetch(`https://${host}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
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
      audience: clientId,
    });
    return payload;
  } catch {
    return null;
  }
}
