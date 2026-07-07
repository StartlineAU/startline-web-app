import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";
import prisma from "./prisma";

export type ServerSession = {
  sub:    string;
  email:  string;
  groups: string[];
};

export type UserSession = {
  sub:   string; // Prisma User.id
  email: string;
  name:  string | null;
};

export type OrganiserSession = {
  sub:      string; // Prisma Organiser.id
  email:    string;
  status:   string;
  verified: boolean;
};

export type AdminSession = {
  sub:   string; // Prisma Admin.id
  email: string;
  name:  string | null;
};

const region   = process.env.NEXT_PUBLIC_AWS_REGION          ?? "";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const clientId   = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";

const cognitoDomain = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const JWKS = createRemoteJWKSet(
  new URL(`${cognitoDomain}/.well-known/jwks.json`)
);

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: cognitoDomain,
    audience: undefined,
  });
  return payload;
}

export async function getServerSession(): Promise<ServerSession | null> {
  try {
    const cookieStore = await cookies();

    const lastAuthUser = cookieStore.get(
      `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`
    )?.value;
    if (!lastAuthUser) return null;

    const accessToken = (
      cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)?.value ??
      cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.accessToken`)?.value
    );
    if (!accessToken) return null;

    const payload = await verifyToken(accessToken);

    const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
    const sub   = payload.sub as string;
    const email = lastAuthUser;

    return { sub, email, groups };
  } catch {
    return null;
  }
}

export async function getUserSession(): Promise<UserSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const user = await prisma.user.upsert({
      where:  { cognitoSub: cognitoSession.sub },
      update: { email: cognitoSession.email },
      create: { cognitoSub: cognitoSession.sub, email: cognitoSession.email },
      select: { id: true, email: true, name: true },
    });
    return { sub: user.id, email: user.email, name: user.name };
  } catch {
    return null;
  }
}

export async function getOrganiserSession(): Promise<OrganiserSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { cognitoSub: cognitoSession.sub },
    });
    if (!user) return null;

    const organiser = await prisma.organiser.findUnique({
      where:  { userId: user.id },
      select: { id: true, email: true, status: true, verified: true },
    });
    if (!organiser) return null;

    return { sub: organiser.id, email: organiser.email, status: String(organiser.status), verified: organiser.verified };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;
  if (!cognitoSession.groups.includes("admins")) return null;

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
