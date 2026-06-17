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

export type AthleteSession = {
  sub:   string; // Prisma Athlete.id
  email: string;
  name:  string | null;
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

export async function getServerSession(): Promise<ServerSession | null> {
  try {
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
      sub:   user.userId,
      email: user.signInDetails?.loginId ?? "",
      groups,
    };
  } catch {
    return null;
  }
}

export async function getAthleteSession(): Promise<AthleteSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const athlete = await prisma.athlete.findUnique({
      where:  { cognitoSub: cognitoSession.sub },
      select: { id: true, email: true, name: true },
    });
    if (!athlete) return null;
    return { sub: athlete.id, email: athlete.email, name: athlete.name };
  } catch {
    return null;
  }
}

export async function getOrganiserSession(): Promise<OrganiserSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

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
    const admin = await prisma.admin.upsert({
      where:  { cognitoSub: cognitoSession.sub },
      update: { email: cognitoSession.email },
      create: { cognitoSub: cognitoSession.sub, email: cognitoSession.email },
      select: { id: true, email: true, name: true },
    });
    return { sub: admin.id, email: admin.email, name: admin.name };
  } catch {
    return null;
  }
}
