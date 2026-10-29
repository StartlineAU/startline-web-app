// Shared by the browser and the server. The sign-in flow itself lives in
// lib/social-sign-in.ts, which pulls in Amplify; this module stays free of it so
// route handlers can read the same provider names.

export type SocialProvider = "google" | "apple";

export const SOCIAL_PROVIDERS: SocialProvider[] = ["google", "apple"];

const LABELS: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
};

// The provider names Cognito stores in a user's `identities` attribute and
// expects in AdminLinkProviderForUser. Apple signs in as SignInWithApple, not
// "Apple": Amplify's UI name and Cognito's provider name are not the same.
const COGNITO_NAMES: Record<SocialProvider, string> = {
  google: "Google",
  apple: "SignInWithApple",
};

export function socialProviderLabel(provider: SocialProvider): string {
  return LABELS[provider];
}

export function cognitoProviderName(provider: SocialProvider): string {
  return COGNITO_NAMES[provider];
}

export function socialProviderFromCognitoName(name: string): SocialProvider | null {
  return SOCIAL_PROVIDERS.find((provider) => COGNITO_NAMES[provider] === name) ?? null;
}

// Terraform lists only the providers whose keys exist, and a deployment without
// a Cognito domain (local dev, the Docker image) has none.
export function enabledSocialProviders(): SocialProvider[] {
  if (!process.env.NEXT_PUBLIC_COGNITO_DOMAIN) return [];
  return (process.env.NEXT_PUBLIC_SOCIAL_SIGN_IN ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is SocialProvider => p === "google" || p === "apple");
}
