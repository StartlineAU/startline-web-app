import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { amplifyConfig } from "./amplify-config";

const prisma = new PrismaClient();

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

export async function getServerSession(): Promise<ServerSession | null> {
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true") {
    return { sub: "dev-organiser-sub", email: "dev@example.com", groups: [] };
  }

  try {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    });

    if (!session.tokens?.accessToken) return null;

    const groups =
      (session.tokens.accessToken.payload["cognito:groups"] as string[] | undefined) ?? [];

    const user = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => getCurrentUser(contextSpec),
    });

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

    return { sub: organiser.id, email: organiser.email, status: organiser.status };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true") {
    return { sub: "dev-admin-id", email: "admin@startlineau.com", name: "Dev Admin" };
  }

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
