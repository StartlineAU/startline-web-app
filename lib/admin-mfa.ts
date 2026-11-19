import { getCognitoUserSnapshot } from "@/lib/cognito-sign-in-methods";

/**
 * Whether an admin's Cognito user has an authenticator app (software token
 * MFA) turned on.
 *
 * The pool's MFA is optional, so the `admins` group alone would let a phished
 * or reused password open the admin portal. getAdminSession requires this as
 * well. Cognito is asked rather than the app's mfaEnabled flag, because only
 * Cognito decides whether sign-in asks for a code.
 *
 * A yes is cached per Cognito user for a short while: every admin API call
 * resolves the session, and AdminGetUser is rate limited. Turning the app off
 * is refused for admins (app/api/user/mfa), so a stale "yes" cannot outlive a
 * downgrade made through Startline.
 */
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { ok: boolean; expires: number }>();

export async function adminHasAuthenticator(session: {
  sub: string;
  username?: string;
  bypass?: string;
}): Promise<boolean> {
  // Dev/E2E bypass identities never touch Cognito.
  if (session.bypass) return true;
  // Without a pool there is no Cognito to ask: only acceptable off production.
  if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) return process.env.NODE_ENV !== "production";
  if (!session.username) return false;

  const cached = cache.get(session.sub);
  if (cached && cached.expires > Date.now()) return cached.ok;

  try {
    const snapshot = await getCognitoUserSnapshot(session.username);
    const ok = snapshot.mfaEnabled;
    // Only a yes is cached. A no is asked again next time, so an admin who has
    // just set the app up is let in at once by every server instance.
    if (ok) cache.set(session.sub, { ok, expires: Date.now() + CACHE_MS });
    return ok;
  } catch (err) {
    console.error("Admin MFA lookup failed:", err);
    return false;
  }
}

/** Forget a cached answer, after the person changes their MFA setting. */
export function forgetAdminAuthenticator(sub: string): void {
  cache.delete(sub);
}
