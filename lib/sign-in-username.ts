/**
 * The identifier Amplify should send to Cognito for a password sign-in.
 *
 * Native users can use their email. A Google or Apple profile keeps a
 * provider-generated username (`Google_...`) even after a password is added,
 * so the server resolves the email to that username. If the lookup fails, the
 * email is still the right choice for the common case.
 */
export async function resolveSignInUsername(email: string): Promise<string> {
  try {
    const res = await fetch("/api/user/signin-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return email;
    const data = (await res.json().catch(() => ({}))) as { username?: unknown };
    return typeof data.username === "string" && data.username ? data.username : email;
  } catch {
    return email;
  }
}
