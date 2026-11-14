import { cookies, headers } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { OrganiserRole } from "@prisma/client";
import prisma from "./prisma";
import { pickActiveMembership } from "./active-organiser";
import { nativeSessionFromClaims } from "./native-api-auth";
import { resolveUserRow } from "./user-session";

export type ServerSession = {
  sub:          string;
  // Cognito username, which AdminGetUser and AdminLinkProviderForUser take.
  // Usually the email for password users and a UUID for provider users, so it
  // is not interchangeable with `sub`.
  username?:    string;
  email:        string;
  groups:       string[];
  phoneNumber?: string;
  birthdate?:   string;
  // From the id token. name is set by Google and Apple; emailTrusted is false
  // only for a Google or Apple sign-in whose provider did not verify the email.
  name?:         string;
  emailTrusted?: boolean;
  // The dev/E2E identity that produced this session, if any. Used by the
  // settings screen to model provider-only and linked accounts without Cognito.
  bypass?: string;
};

export type UserSession = {
  sub:          string; // Prisma User.id
  email:        string;
  name:         string | null;
  phoneNumber?: string;
  birthdate?:   string;
};

export type OrganiserSession = {
  sub:      string; // Prisma Organiser.id
  email:    string;
  status:   string;
  verified: boolean;
  role:     OrganiserRole;
};

export type OrganiserMembership = {
  organiserId:   string;
  organiserName: string | null;
  role:          OrganiserRole;
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
  // Audience and token_use are checked by nativeSessionFromClaims, because
  // Cognito access tokens carry `client_id` rather than `aud`.
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: cognitoDomain,
    algorithms: ["RS256"],
  });
  return payload;
}

type BearerCredentials = {
  present: boolean;
  accessToken?: string;
  idToken?: string;
};

/**
 * Read the native app's credentials without trusting them.
 *
 * The mobile app sends the Cognito access token as the bearer credential and
 * its ID token as a companion header for profile claims. Both are verified
 * below. A browser request never sets these headers, so cookie authentication
 * remains the default for every existing web surface.
 */
async function readBearerCredentials(): Promise<BearerCredentials> {
  try {
    const requestHeaders = await headers();
    const authorization = requestHeaders.get("authorization");
    if (!authorization) return { present: false };

    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) return { present: true };

    return {
      present: true,
      accessToken: match[1],
      idToken: requestHeaders.get("x-id-token") ?? undefined,
    };
  } catch {
    // Server components outside a request scope cannot read request headers.
    return { present: false };
  }
}

async function getBearerSession(): Promise<{
  present: boolean;
  session: ServerSession | null;
}> {
  const credentials = await readBearerCredentials();
  if (!credentials.present) return { present: false, session: null };
  if (!credentials.accessToken) return { present: true, session: null };

  try {
    const accessPayload = await verifyToken(credentials.accessToken);
    let idPayload = null;
    if (credentials.idToken) {
      idPayload = await verifyToken(credentials.idToken);
    }

    const native = nativeSessionFromClaims(
      accessPayload as Record<string, unknown>,
      idPayload as Record<string, unknown> | null,
      clientId,
    );
    if (!native) return { present: true, session: null };

    return {
      present: true,
      session: {
        ...native,
        // The native client is a real Cognito session, never a dev bypass.
        bypass: undefined,
      },
    };
  } catch {
    return { present: true, session: null };
  }
}

/**
 * The access token belonging to this request, from the native bearer header
 * first and the Amplify cookie second. Callers use this for Cognito operations
 * performed as the signed-in user; they must authenticate the request through
 * getServerSession/getUserSession before relying on it.
 */
export async function getRequestAccessToken(): Promise<string | null> {
  const credentials = await readBearerCredentials();
  if (credentials.present) return credentials.accessToken ?? null;

  const cookieStore = await cookies();
  const lastAuthUser = cookieStore.get(
    `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`
  )?.value;
  if (!lastAuthUser) return null;
  return (
    cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)?.value ??
    cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.accessToken`)?.value ??
    null
  );
}

export async function getServerSession(): Promise<ServerSession | null> {
  if (process.env.NODE_ENV === "development") {
    const cookieStore = await cookies().catch(() => null);
    const bypass = cookieStore?.get("__e2e_bypass")?.value;
    if (bypass) {
      const identities: Record<string, ServerSession> = {
        "1":        { sub: "dev-bypass-organiser", email: "sarah.mitchell@startline.test",  groups: ["admins"] },
        "organiser": { sub: "dev-bypass-organiser", email: "sarah.mitchell@startline.test",  groups: [] },
        "member":   { sub: "dev-bypass-member",    email: "tom.whitfield@startline.test",   groups: [] },
        "admin":    { sub: "dev-bypass-admin",     email: "marcus.stirling@startline.test", groups: ["admins"] },
        "user":     { sub: "dev-bypass-user",      email: "jade.nguyen@startline.test",      groups: [] },
        "avery":    { sub: "dev-bypass-avery-quinn", email: "avery.quinn@startline.test",    groups: [] },
        // Belongs to no organisation, for the "become an organiser" paths.
        // Every other identity here owns or manages one.
        "athlete":  { sub: "dev-bypass-harper-jones", email: "harper.jones@startline.test", groups: [] },
        // Rows these identities point at are created and removed by the specs
        // that use them, so tests never mutate the shared seed users.
        "profile":  { sub: "dev-bypass-profile-test", email: "profile.test@startline.test", groups: [] },
        "noabn":    { sub: "dev-bypass-noabn-test",   email: "noabn.organiser@startline.test", groups: [] },
        // Owns an organisation that security.spec.ts suspends. Its own rows, so
        // suspending it never disturbs a spec running in the other worker.
        "suspended": { sub: "dev-bypass-suspended-test", email: "suspended.organiser@startline.test", groups: [] },
        // Login & security states for issue #389. The sign-in-methods route
        // returns a fixed state for these; they only give the page a signed-in
        // visitor without contacting Cognito.
        "social":   { sub: "dev-bypass-social-test",  email: "social.test@startline.test", groups: [] },
        "apple":    { sub: "dev-bypass-apple-test",   email: "apple.test@startline.test",  groups: [] },
        "linked":   { sub: "dev-bypass-linked-test",  email: "linked.test@startline.test", groups: [] },
      };
      const identity = identities[bypass];
      if (identity) return { ...identity, bypass };
    }
  }

  // A request carrying bearer credentials is native. If those credentials are
  // invalid, fail it rather than silently falling back to an unrelated cookie.
  const bearer = await getBearerSession();
  if (bearer.present) return bearer.session;

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

    const idToken = (
      cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`)?.value ??
      cookieStore.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.idToken`)?.value
    );
    // Amplify always stores both tokens. A request with only an access token
    // is not a browser session, and without the id token there is no email we
    // can trust: the cookie names, LastAuthUser included, are chosen by the
    // client, so nothing about identity may be read from them.
    if (!idToken) return null;

    const accessPayload = await verifyToken(accessToken);
    const idPayload = await verifyToken(idToken);

    // Same checks as the native path: an access token issued to this client,
    // and an id token for the same client and the same subject. Without the
    // subject check, someone could pair their own access token with another
    // person's id token.
    const session = nativeSessionFromClaims(
      accessPayload as Record<string, unknown>,
      idPayload as Record<string, unknown>,
      clientId,
    );
    if (!session) return null;

    return { ...session, bypass: undefined };
  } catch {
    return null;
  }
}

export async function getUserSession(): Promise<UserSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const user = await resolveUserRow(cognitoSession);
    if (!user) return null;
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      phoneNumber: cognitoSession.phoneNumber,
      birthdate: cognitoSession.birthdate,
    };
  } catch {
    return null;
  }
}

const ACTIVE_ORG_COOKIE = "startline_active_org";

// Resolves the user's memberships to an active Organiser. If the user manages
// multiple organisers, the `startline_active_org` cookie (set by the org
// switcher) picks the active one; otherwise the OWNER membership wins.
// `cognitoSession` lets a caller that has already verified the tokens (e.g.
// `requireOrganiser`, which needs to tell "signed out" from "not an organiser")
// pass them in rather than paying for a second JWT verification per request.
export async function getOrganiserSession(
  cognitoSession?: ServerSession | null,
): Promise<OrganiserSession | null> {
  try {
    return await resolveOrganiserSession(cognitoSession);
  } catch {
    return null;
  }
}

// Same resolution, but a database failure propagates instead of collapsing into
// the same `null` as "this account manages no organiser". `requireOrganiser`
// needs the two apart: swallowing them together told every organiser their
// account wasn't linked to an organiser profile whenever the database was
// briefly unreachable, which reads exactly like the data loss in issue #302.
export async function resolveOrganiserSession(
  cognitoSession?: ServerSession | null,
): Promise<OrganiserSession | null> {
  cognitoSession ??= await getServerSession();
  if (!cognitoSession) return null;

  const user = await prisma.user.findUnique({
    // A banned account manages nothing, whatever its memberships say.
    where: { cognitoSub: cognitoSession.sub, isBanned: false },
    include: {
      memberships: {
        include: {
          organiser: {
            select: { id: true, email: true, status: true, verified: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user || user.memberships.length === 0) return null;

  const activeId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const picked = pickActiveMembership(
    user.memberships.map((m) => ({ organiserId: m.organiser.id, role: m.role })),
    activeId,
  );
  const membership =
    user.memberships.find((m) => m.organiser.id === picked?.organiserId) ??
    user.memberships[0];

  const organiser = membership.organiser;
  return {
    sub:      organiser.id,
    email:    organiser.email,
    status:   String(organiser.status),
    verified: organiser.verified,
    role:     membership.role,
  };
}

export async function getOrganiserMemberships(): Promise<OrganiserMembership[] | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { cognitoSub: cognitoSession.sub, isBanned: false },
      select: {
        memberships: {
          select: {
            role:       true,
            organiser:  { select: { id: true, orgName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user) return null;

    return user.memberships.map((m) => ({
      organiserId:   m.organiser.id,
      organiserName: m.organiser.orgName,
      role:          m.role,
    }));
  } catch {
    return null;
  }
}

export async function getOrganiserRole(organiserId: string): Promise<OrganiserRole | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;

  try {
    const membership = await prisma.organiserMember.findFirst({
      where: {
        organiserId,
        user: { cognitoSub: cognitoSession.sub, isBanned: false },
      },
      select: { role: true },
    });
    return membership?.role ?? null;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cognitoSession = await getServerSession();
  if (!cognitoSession) return null;
  if (!cognitoSession.groups.includes("admins")) return null;

  try {
    return await resolveAdminRow(cognitoSession);
  } catch {
    return null;
  }
}

/**
 * The Admin row for a session already known to be in the `admins` group. The
 * row is for attribution only (reviews, audit log); the group is what grants
 * admin. It is found by sub. An existing row is only matched by email when that
 * email is verified, and then re-pointed at this sub, so the audit trail never
 * credits one admin's actions to another's row on an unverified address.
 */
export async function resolveAdminRow(session: ServerSession): Promise<AdminSession | null> {
  const select = { id: true, email: true, name: true } as const;
  const toSession = (row: { id: string; email: string; name: string | null }) =>
    ({ sub: row.id, email: row.email, name: row.name });

  const bySub = await prisma.admin.findUnique({ where: { cognitoSub: session.sub }, select });
  if (bySub) return toSession(bySub);

  const email = session.email;
  if (!email) return null;

  // Dev bypass identities share the seeded admin's email under a made-up sub.
  // Use that row as it is rather than re-pointing it at the fake sub.
  if (session.bypass) {
    const seeded = await prisma.admin.findUnique({ where: { email }, select });
    return seeded ? toSession(seeded) : null;
  }

  if (!session.emailTrusted) return null;

  const row = await prisma.admin.upsert({
    where:  { email },
    update: { cognitoSub: session.sub },
    create: { cognitoSub: session.sub, email },
    select,
  });
  return toSession(row);
}
