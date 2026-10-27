import { signInWithRedirect } from "aws-amplify/auth";

export type SocialProvider = "google" | "apple";

const AMPLIFY_PROVIDER = { google: "Google", apple: "Apple" } as const;

const RETURN_TO_KEY = "startline_social_return_to";
const PROVIDER_KEY  = "startline_social_provider";
const RETRIED_KEY   = "startline_social_retried";

// Terraform lists only the providers whose keys are in ci-bootstrap, and a
// deployment without a Cognito domain (local dev, the Docker image) has none.
export function enabledSocialProviders(): SocialProvider[] {
  if (!process.env.NEXT_PUBLIC_COGNITO_DOMAIN) return [];
  return (process.env.NEXT_PUBLIC_SOCIAL_SIGN_IN ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is SocialProvider => p === "google" || p === "apple");
}

// Leaves the page for Google or Apple. The return path and provider sit in
// sessionStorage so /auth/callback can send the person back where they were,
// or retry once when Cognito has just linked the account (see callback page).
export async function startSocialSignIn(provider: SocialProvider, returnTo?: string) {
  try {
    sessionStorage.setItem(RETURN_TO_KEY, returnTo ?? window.location.pathname + window.location.search);
    sessionStorage.setItem(PROVIDER_KEY, provider);
  } catch {
    // Storage blocked: the person lands on the home page instead.
  }
  await signInWithRedirect({ provider: AMPLIFY_PROVIDER[provider] });
}

// Same-site paths only, so a crafted value cannot send someone off-site.
function sanitiseReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth/callback")) return "/";
  return value;
}

// Reads the return path without consuming it, so a retry can keep it.
export function peekSocialReturnTo(): string {
  try {
    return sanitiseReturnTo(sessionStorage.getItem(RETURN_TO_KEY));
  } catch {
    return "/";
  }
}

// Consumes the whole flow: the path to land on, plus the provider and retry
// markers, which must not survive into a later sign-in.
export function takeSocialReturnTo(): string {
  let value: string | null = null;
  try {
    value = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    sessionStorage.removeItem(PROVIDER_KEY);
    sessionStorage.removeItem(RETRIED_KEY);
  } catch {}
  return sanitiseReturnTo(value);
}

// One automatic retry per sign-in, for the "Already found an entry" reply.
export function claimSocialRetry(): SocialProvider | null {
  try {
    if (sessionStorage.getItem(RETRIED_KEY)) return null;
    const provider = sessionStorage.getItem(PROVIDER_KEY);
    if (provider !== "google" && provider !== "apple") return null;
    sessionStorage.setItem(RETRIED_KEY, "1");
    return provider;
  } catch {
    return null;
  }
}

// What /auth/callback does next, given what Cognito sent back. Kept separate
// from the component so every branch, including the successful one, is testable.
export type SocialCallbackPlan =
  | { kind: "retry"; provider: SocialProvider; returnTo: string }
  | { kind: "signed-in"; returnTo: string }
  | { kind: "error"; message: string };

export function planSocialCallback(failure: string | null): SocialCallbackPlan {
  if (!failure) {
    return { kind: "signed-in", returnTo: takeSocialReturnTo() };
  }
  if (isLinkedAccountRetry(failure)) {
    const provider = claimSocialRetry();
    // Keep the page they started from: the retry would otherwise store the
    // callback URL itself and land them on the home page.
    if (provider) return { kind: "retry", provider, returnTo: peekSocialReturnTo() };
  }
  takeSocialReturnTo();
  return { kind: "error", message: socialSignInErrorMessage(failure) };
}

// Cognito reports a pre sign-up refusal as "PreSignUp failed with error
// STARTLINE_...". The codes come from the trigger in startline-infra
// (lambda/pre-signup/index.mjs).
export function socialSignInErrorMessage(description: string): string {
  if (description.includes("STARTLINE_MFA_ACCOUNT")) {
    return "This account is protected by an authenticator app, so it can't use Google or Apple sign-in. Sign in with your email and password instead.";
  }
  if (description.includes("STARTLINE_FEDERATED_ACCOUNT")) {
    return "This email already signs in with Google or Apple. Use that button instead.";
  }
  if (description.includes("STARTLINE_LOOKUP_FAILED")) {
    return "We couldn't check your account just now. Please try again in a moment.";
  }
  if (/access_denied|cancel/i.test(description)) {
    return "Sign-in was cancelled.";
  }
  return "We couldn't sign you in. Please try again.";
}

export function isLinkedAccountRetry(description: string): boolean {
  return description.includes("Already found an entry for username");
}
