import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client();

const ROLE_CLAIM = "https://www.startlineau.com/role";

export type UserRole = "user" | "organiser";

export function getRole(session: {
  user: Record<string, unknown>;
}): UserRole {
  const role = session.user[ROLE_CLAIM];
  if (role === "organiser") return "organiser";
  return "user";
}

export function getUserSub(session: {
  user: Record<string, unknown>;
}): string {
  return session.user.sub as string;
}

/**
 * Server-side session getter — thin wrapper around the SDK so existing
 * API routes continue to work without changes.
 */
export async function getServerSession(): Promise<{
  user: Record<string, unknown>;
} | null> {
  const session = await auth0.getSession();
  if (!session) return null;
  return session as { user: Record<string, unknown> };
}
