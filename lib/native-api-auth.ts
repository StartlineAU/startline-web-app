/**
 * Claims accepted from the native app's Cognito session.
 *
 * The app sends its access token as `Authorization: Bearer …` and, separately,
 * its ID token as `X-Id-Token`. Access tokens carry the identity (`sub`,
 * groups) but no email; the ID token carries the verified profile attributes.
 * Both must describe the same person and be issued to the same app client.
 *
 * Keep this pure: token signature verification happens in amplify-server.ts,
 * which then hands the verified payloads here.
 */

export interface NativeApiSession {
  sub: string;
  username?: string;
  email: string;
  groups: string[];
  phoneNumber?: string;
  birthdate?: string;
  name?: string;
  emailTrusted: boolean;
}

type Claims = Record<string, unknown>;

function stringClaim(payload: Claims, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value ? value : undefined;
}

export function accessTokenIsForClient(payload: Claims, clientId: string): boolean {
  return payload.token_use === "access" && payload.client_id === clientId;
}

export function idTokenIsForClient(
  payload: Claims,
  clientId: string,
  accessTokenSub: string,
): boolean {
  const audience = payload.aud;
  const audienceMatches = Array.isArray(audience)
    ? audience.includes(clientId)
    : audience === clientId;

  return (
    payload.token_use === "id" &&
    audienceMatches &&
    payload.sub === accessTokenSub
  );
}

/** Build the server session from already-verified token payloads. */
export function nativeSessionFromClaims(
  accessPayload: Claims,
  idPayload: Claims | null,
  clientId: string,
): NativeApiSession | null {
  if (!accessTokenIsForClient(accessPayload, clientId)) return null;

  const sub = stringClaim(accessPayload, "sub");
  if (!sub) return null;

  if (idPayload && !idTokenIsForClient(idPayload, clientId, sub)) return null;

  const groups = Array.isArray(accessPayload["cognito:groups"])
    ? (accessPayload["cognito:groups"] as unknown[]).filter(
        (group): group is string => typeof group === "string",
      )
    : [];

  const email = idPayload ? stringClaim(idPayload, "email") ?? "" : "";
  const name = idPayload ? stringClaim(idPayload, "name") : undefined;
  const phoneNumber = idPayload
    ? stringClaim(idPayload, "phone_number") ?? stringClaim(accessPayload, "phone_number")
    : stringClaim(accessPayload, "phone_number");
  const birthdate = idPayload
    ? stringClaim(idPayload, "birthdate") ?? stringClaim(accessPayload, "birthdate")
    : stringClaim(accessPayload, "birthdate");

  // Only an address Cognito has verified may tie this sign-in to an existing
  // account. That holds for password users too: an admin-created or migrated
  // user can carry an email nobody has proved they own.
  const emailTrusted = idPayload
    ? Boolean(email) && String(idPayload.email_verified) === "true"
    : false;

  return {
    sub,
    username: stringClaim(accessPayload, "username"),
    email,
    groups,
    phoneNumber,
    birthdate,
    name,
    emailTrusted,
  };
}
