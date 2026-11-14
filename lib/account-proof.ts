import {
  SignInMethodError,
  verifyAuthenticatorStepUp,
  verifyPasswordStepUp,
} from "@/lib/cognito-sign-in-methods";
import type { SignInMethods } from "@/lib/sign-in-methods";

/**
 * Proof, beyond a signed-in session, that the person at the keyboard owns the
 * account. Asked for before changes a stolen session must not be able to make
 * on its own: adding a way in (linking Google or Apple) and deleting the
 * account.
 *
 *   password-and-code  an account with an authenticator app
 *   password           an account with a password
 *   recent-sign-in     a Google/Apple-only account, which has neither: it must
 *                      have signed in within the last few minutes
 */
export type AccountProofKind = "password-and-code" | "password" | "recent-sign-in";

export const RECENT_SIGN_IN_SECONDS = 10 * 60;

export function accountProofKind(methods: Pick<SignInMethods, "hasPassword" | "mfaRequired">): AccountProofKind {
  if (methods.mfaRequired) return "password-and-code";
  if (methods.hasPassword) return "password";
  return "recent-sign-in";
}

export async function requireAccountProof(
  session: { username?: string; authTime?: number; bypass?: string },
  methods: Pick<SignInMethods, "hasPassword" | "mfaRequired">,
  body: { password?: string; code?: string },
  now: number = Date.now(),
): Promise<void> {
  // Dev/E2E bypass identities have no Cognito user to check against.
  if (session.bypass) return;
  if (!session.username) {
    throw new SignInMethodError("unavailable", 503, "Sign-in methods cannot be managed in this environment.");
  }

  switch (accountProofKind(methods)) {
    case "password-and-code":
      if (!body.password || !body.code) {
        throw new SignInMethodError(
          "step-up-required",
          400,
          "Enter your password and a code from your authenticator app.",
        );
      }
      await verifyAuthenticatorStepUp({ username: session.username, password: body.password, code: body.code });
      return;
    case "password":
      if (!body.password) {
        throw new SignInMethodError("password-proof-required", 400, "Enter your password to continue.");
      }
      await verifyPasswordStepUp({ username: session.username, password: body.password });
      return;
    case "recent-sign-in":
      if (now / 1000 - (session.authTime ?? 0) > RECENT_SIGN_IN_SECONDS) {
        throw new SignInMethodError(
          "recent-sign-in-required",
          403,
          "For your security, sign out and sign in again, then try this again.",
        );
      }
      return;
  }
}
