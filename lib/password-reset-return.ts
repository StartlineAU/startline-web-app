// After a password reset the visitor is signed out and has to sign in with the
// new password, so both forgot-password pages send them back to a page that
// opens the sign-in modal with their email filled in (issue #508). Landing on
// the home page with the modal shut left them hunting for SIGN IN.

export const PASSWORD_RESET_NOTICE = "Password updated. Sign in with your new password.";

/** Where a forgot-password page goes once Cognito accepts the new password. */
export function signInAfterResetHref(path: string, email: string): string {
  const params = new URLSearchParams({ signin: "true", reset: "1" });
  const trimmed = email.trim();
  if (trimmed) params.set("email", trimmed);
  return `${path}?${params.toString()}`;
}

export interface SignInRequest {
  /** Email to prefill, or "" when none was passed. */
  email: string;
  /** True when the visitor has just reset their password. */
  afterReset: boolean;
}

/** Reads a `?signin=true` request from a query string, or null if there is none. */
export function readSignInRequest(search: string): SignInRequest | null {
  const params = new URLSearchParams(search);
  if (params.get("signin") !== "true") return null;
  return {
    email: params.get("email")?.trim() ?? "",
    afterReset: params.get("reset") === "1",
  };
}
