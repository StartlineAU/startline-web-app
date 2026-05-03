import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { amplifyConfig } from "./amplify-config";

const prisma = new PrismaClient();

/**
 * Server runner instance — used in API routes and Server Components to
 * execute Amplify operations within the Next.js request context.
 * Amplify reads the Cognito tokens from httpOnly cookies automatically.
 */
export const { runWithAmplifyServerContext } = createServerRunner({
  config: amplifyConfig,
});

export type ServerSession = {
  sub:   string; // Cognito sub — used as the foreign key in Prisma (cognitoSub)
  email: string;
};

/**
 * Shape returned by getOrganiserSession() — intentionally matches the old
 * TokenPayload from lib/auth.ts so the 5 API routes are a clean import swap.
 * `sub` here is the Prisma organiser UUID (not the Cognito sub).
 */
export type OrganiserSession = {
  sub:    string; // Prisma Organiser.id
  email:  string;
  status: string; // OrganiserStatus
};

/**
 * Resolves the current signed-in user from Amplify cookies.
 * Returns null if there is no valid session.
 *
 * Replaces getOrganiserSession() from the old lib/auth.ts.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  // Local dev shortcut — set DEV_BYPASS=true to skip real auth
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true") {
    return { sub: "dev-organiser-sub", email: "dev@example.com" };
  }

  try {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    });

    if (!session.tokens?.accessToken) return null;

    const user = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => getCurrentUser(contextSpec),
    });

    return {
      sub:   user.userId,
      email: user.signInDetails?.loginId ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * API-route helper — wraps getServerSession() with a Prisma lookup.
 * Returns the Prisma organiser record linked to the signed-in Cognito user.
 * `sub` in the returned object is the Prisma UUID (same shape as the old
 * TokenPayload), so all API routes are a drop-in import swap.
 */
export async function getOrganiserSession(): Promise<OrganiserSession | null> {
  // Dev bypass — return the same mock the old lib/auth.ts used
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true") {
    return { sub: "dev-organiser-id", email: "dev@example.com", status: "APPROVED" };
  }

  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const organiser = await prisma.organiser.findUnique({
      where:  { cognitoSub: cognitoSession.sub },
      select: { id: true, email: true, status: true },
    });
    if (!organiser) return null;

    return {
      sub:    organiser.id,
      email:  organiser.email,
      status: organiser.status,
    };
  } catch {
    return null;
  }
}
