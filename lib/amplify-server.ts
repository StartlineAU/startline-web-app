import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth/server";
import type { AuthSession } from "aws-amplify/auth";
import type { GetCurrentUserOutput } from "aws-amplify/auth";
import { cookies } from "next/headers";
import { amplifyConfig } from "./amplify-config";
import prisma from "./prisma";

export const { runWithAmplifyServerContext } = createServerRunner({
  config: amplifyConfig,
});

export type ServerSession = {
  sub:    string;
  email:  string;
  groups: string[];
};

export type OrganiserSession = {
  sub:    string; // Prisma Organiser.id
  email:  string;
  status: string;
};

export type AdminSession = {
  sub:   string; // Prisma Admin.id
  email: string;
  name:  string | null;
};

// Map seeded organiser emails to their cognitoSub values
// so dev bypass can log in as any seeded user.
const DEV_USERS_BY_EMAIL: Record<string, string> = {
  "test.organiser@startlineau.com": "seed-organiser-cognito-sub-001",
  "hello@coastaltrailrunning.com.au": "coastal-trail-sub",
  "info@urbanfitnessevents.com.au": "urban-fitness-sub",
};

export async function getServerSession(): Promise<ServerSession | null> {
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true") {
    try {
      const cookieStore = await cookies();
      const email = cookieStore.get("DEV_USER_EMAIL")?.value ?? "dev@example.com";
      const sub = DEV_USERS_BY_EMAIL[email] ?? `dev-${email.replace(/[@.]/g, "-")}`;
      return { sub, email, groups: ["admin-nonprod-users"] };
    } catch {
      // fallback if cookies() isn't available (e.g. during build)
      return { sub: "dev-organiser-sub", email: "dev@example.com", groups: ["admin-nonprod-users"] };
    }
  }

  try {
    // Next.js 15: cookies() is async — await it before passing to Amplify
    const cookieStore = await cookies();
    const cookieFn = () => Promise.resolve(cookieStore);

    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies: cookieFn },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    }) as AuthSession;

    if (!session.tokens?.accessToken) return null;

    const groups =
      (session.tokens.accessToken.payload["cognito:groups"] as string[] | undefined) ?? [];

    const user = await runWithAmplifyServerContext({
      nextServerContext: { cookies: cookieFn },
      operation: (contextSpec) => getCurrentUser(contextSpec),
    }) as GetCurrentUserOutput;

    return {
      sub:    user.userId,
      email:  user.signInDetails?.loginId ?? "",
      groups,
    };
  } catch {
    return null;
  }
}

export async function getOrganiserSession(): Promise<OrganiserSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true") {
    return { sub: cognitoSession.sub, email: cognitoSession.email, status: "APPROVED" };
  }

  try {
    const organiser = await prisma.organiser.upsert({
      where:  { cognitoSub: cognitoSession.sub },
      update: {},
      create: { cognitoSub: cognitoSession.sub, email: cognitoSession.email, status: "APPROVED" },
      select: { id: true, email: true, status: true },
    });
    return { sub: organiser.id, email: organiser.email, status: String(organiser.status) };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;
  if (!cognitoSession.groups.includes("admin-nonprod-users")) return null;

  try {
    const admin = await prisma.admin.findUnique({
      where:  { cognitoSub: cognitoSession.sub },
      select: { id: true, email: true, name: true },
    });
    if (!admin) return null;

    return { sub: admin.id, email: admin.email, name: admin.name };
  } catch {
    return null;
  }
}
