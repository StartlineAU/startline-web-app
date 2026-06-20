import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { fetchAuthSession } from "aws-amplify/auth/server";
import type { AuthSession } from "aws-amplify/auth";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";
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

// ── JWKS setup (same as middleware) ──────────────────────────────────────────

const region   = process.env.NEXT_PUBLIC_AWS_REGION          ?? "";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";
const cognitoEndpoint = process.env.COGNITO_SERVER_ENDPOINT
  ?? process.env.NEXT_PUBLIC_COGNITO_ENDPOINT;

const isLocalCognito = !!cognitoEndpoint;

const jwksBase = isLocalCognito
  ? `${cognitoEndpoint}/${userPoolId}`
  : `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const issuer = isLocalCognito
  ? `${cognitoEndpoint}/${userPoolId}`
  : `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const JWKS = createRemoteJWKSet(
  new URL(`${jwksBase}/.well-known/jwks.json`)
);

// ── Server session (direct JWT verification, bypasses Amplify server-side) ───

export async function getServerSession(): Promise<ServerSession | null> {
  try {
    const cookieStore = await cookies();

    const lastAuthUser = cookieStore.get(
      `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`
    )?.value;
    if (!lastAuthUser) return null;

    const accessToken = cookieStore.get(
      `CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.accessToken`
    )?.value;
    if (!accessToken) return null;

    const { payload } = await jwtVerify(accessToken, JWKS, {
      issuer,
      audience: undefined,
    });

    const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
    const sub   = payload.sub as string;
    const email = lastAuthUser; // from the LastAuthUser cookie (set by Amplify to the user's email)

    return { sub, email, groups };
  } catch {
    return null;
  }
}

// ── Specialised sessions ─────────────────────────────────────────────────────

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
      create: { cognitoSub: cognitoSession.sub, email: cognitoSession.email, status: "APPROVED", orgName: cognitoSession.email, abn: "", photos: [] },
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
