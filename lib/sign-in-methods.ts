import {
  SOCIAL_PROVIDERS,
  socialProviderFromCognitoName,
  socialProviderLabel,
  type SocialProvider,
} from "./social-providers";

export type CognitoAttribute = { Name?: string; Value?: string };

export type LinkedIdentity = {
  provider: SocialProvider;
  // Cognito's provider name, which is what AdminDisableProviderForUser wants.
  providerName: string;
  // The provider's own stable subject (Google's `sub`, Apple's `sub`).
  subject: string;
};

export type SignInMethod = {
  provider: SocialProvider;
  label: string;
  linked: boolean;
  enabled: boolean;
  canRemove: boolean;
};

export type SignInMethods = {
  hasPassword: boolean;
  providers: SignInMethod[];
};

export type CognitoUserSnapshot = {
  userStatus: string | null;
  attributes: CognitoAttribute[];
};

// `identities` is a JSON array on the user profile, e.g.
// [{ userId: "123", providerName: "Google", ... }]. Malformed or unfamiliar
// providers are ignored rather than failing the whole screen.
export function parseIdentities(value: string | undefined | null): LinkedIdentity[] {
  if (!value) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  return parseIdentityEntries(parsed);
}

// The id-token `identities` claim is the same array, already parsed by the JWT
// library; the user profile stores it as a JSON string.
export function parseIdentityEntries(parsed: unknown): LinkedIdentity[] {
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<SocialProvider>();
  const identities: LinkedIdentity[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const providerName = typeof record.providerName === "string" ? record.providerName : "";
    const subject = typeof record.userId === "string" ? record.userId : "";
    const provider = socialProviderFromCognitoName(providerName);
    if (!provider || !subject || seen.has(provider)) continue;
    seen.add(provider);
    identities.push({ provider, providerName, subject });
  }
  return identities;
}

export function identitiesFromSnapshot(snapshot: CognitoUserSnapshot): LinkedIdentity[] {
  const value = snapshot.attributes.find((attribute) => attribute.Name === "identities")?.Value;
  return parseIdentities(value);
}

export function identityFor(
  identities: LinkedIdentity[],
  provider: SocialProvider,
): LinkedIdentity | null {
  return identities.find((identity) => identity.provider === provider) ?? null;
}

// A password is the other usable way in. TOTP is not: a provider-only account
// with an authenticator app still has no way to sign in if its last provider is
// disconnected.
export function hasPassword(userStatus: string | null): boolean {
  return userStatus !== "EXTERNAL_PROVIDER";
}

// Every provider is listed once. A linked provider stays visible even if this
// deployment has stopped offering it, because it is still a way into the
// account and has to be removable.
export function signInMethodsFromCognito(
  snapshot: CognitoUserSnapshot,
  enabledProviders: SocialProvider[] = [],
): SignInMethods {
  const identities = identitiesFromSnapshot(snapshot);
  const enabled = new Set(enabledProviders);
  const password = hasPassword(snapshot.userStatus);

  // Removing one method has to leave at least one way to sign in.
  const usable = (password ? 1 : 0) + identities.length;
  const mayRemove = identities.length > 0 && usable > 1;

  return {
    hasPassword: password,
    providers: SOCIAL_PROVIDERS.map((provider) => {
      const linked = Boolean(identityFor(identities, provider));
      return {
        provider,
        label: socialProviderLabel(provider),
        linked,
        enabled: enabled.has(provider),
        canRemove: linked && mayRemove,
      };
    }),
  };
}

export function mayRemoveProvider(methods: SignInMethods, provider: SocialProvider): boolean {
  return methods.providers.find((method) => method.provider === provider)?.canRemove ?? false;
}

export function linkedProviders(methods: SignInMethods): SocialProvider[] {
  return methods.providers.filter((method) => method.linked).map((method) => method.provider);
}

// An email change is only durable once no provider can write the address back
// on the next provider sign-in. A password is needed as the remaining way in.
export function canChangeEmail(methods: SignInMethods): boolean {
  return methods.hasPassword && linkedProviders(methods).length === 0;
}

// TOTP is a challenge on the Cognito password flow. A provider sign-in goes
// through the provider and may bypass it, so setup needs a password first.
export function canUseMfa(methods: SignInMethods): boolean {
  return methods.hasPassword;
}

// What /auth/link/callback can put in the URL. Kept here so the callback and
// the settings card cannot drift apart.
export function linkErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "already-linked":
      return "That account is already connected to a different Startline account.";
    case "last-method":
      return "Connect another way to sign in before disconnecting this one.";
    case "cancelled":
      return "Connecting that account was cancelled.";
    case "rate-limited":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "not-enabled":
      return "That sign-in provider is not available on this deployment.";
    case "unavailable":
      return "Sign-in methods cannot be managed in this environment.";
    default:
      return "We couldn't connect that account. Please try again.";
  }
}

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/auth/")) return "/";
  return value;
}
