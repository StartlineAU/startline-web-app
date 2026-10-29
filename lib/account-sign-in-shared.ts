// Client-safe types and rules for Login & security. The Cognito calls live in
// lib/account-sign-in.ts, which must never be imported by a client component.

export type SignInProvider = "google" | "apple";

export type LinkedIdentity = {
  provider:     SignInProvider;
  /** Cognito's provider name, e.g. Google or SignInWithApple. */
  providerName: string;
  /** The provider's immutable subject for this person. */
  userId:       string;
};

export type AccountSignInState = {
  hasPassword: boolean;
  identities:  LinkedIdentity[];
};

const PROVIDER_NAMES: Record<string, SignInProvider> = {
  Google:          "google",
  SignInWithApple: "apple",
};

/**
 * Reads the `identities` attribute Cognito writes for a linked provider.
 * Anything malformed is ignored rather than turning into a settings failure.
 */
export function parseIdentities(raw: string | undefined): LinkedIdentity[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const identities: LinkedIdentity[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const providerName = typeof record.providerName === "string" ? record.providerName : "";
    const userId       = typeof record.userId === "string" ? record.userId : "";
    const provider     = PROVIDER_NAMES[providerName];
    if (!provider || !userId || seen.has(`${provider}:${userId}`)) continue;
    seen.add(`${provider}:${userId}`);
    identities.push({ provider, providerName, userId });
  }
  return identities;
}

export function providerLabel(provider: SignInProvider): string {
  return provider === "google" ? "Google" : "Apple";
}

export function providerListLabel(providers: SignInProvider[]): string {
  const labels = providers.map(providerLabel);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

// Changing the email here only sticks once the provider can no longer write it
// back on the next sign-in.
export function canChangeEmail(state: AccountSignInState): boolean {
  return state.hasPassword && state.identities.length === 0;
}

// TOTP is a challenge on the password flow. A provider sign-in goes through the
// provider and may bypass it, so it is only offered once there is a password.
export function canUseMfa(state: AccountSignInState): boolean {
  return state.hasPassword;
}

export function canUnlinkProvider(state: AccountSignInState, provider: SignInProvider): boolean {
  return state.hasPassword && state.identities.some((identity) => identity.provider === provider);
}

/**
 * E2E bypass identities have no Cognito session, so the settings screen uses
 * these fixed states. They live here rather than in the UI so the API tests and
 * the page see the same answer.
 */
export function simulatedSignInState(bypass: string): AccountSignInState {
  if (bypass === "social") {
    return {
      hasPassword: false,
      identities:  [{ provider: "google", providerName: "Google", userId: "google-social" }],
    };
  }
  if (bypass === "apple") {
    return {
      hasPassword: false,
      identities:  [{ provider: "apple", providerName: "SignInWithApple", userId: "apple-social" }],
    };
  }
  if (bypass === "linked") {
    return {
      hasPassword: true,
      identities:  [{ provider: "google", providerName: "Google", userId: "google-linked" }],
    };
  }
  return { hasPassword: true, identities: [] };
}
