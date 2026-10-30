import type { Metadata } from "next";
import SocialCallback from "./SocialCallback";

export const metadata: Metadata = {
  title: "Signing in | Startline",
  robots: { index: false },
};

// Google and Apple hand back to Cognito, and Cognito hands back here with
// either ?code=... or ?error=.... The error is read on the server because
// Amplify rewrites the address bar as soon as it loads, before a client
// component could read it.
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  const { error, error_description } = await searchParams;
  const failure = error ? `${error} ${error_description ?? ""}`.trim() : null;
  return <SocialCallback failure={failure} />;
}
