import prisma from "@/lib/prisma";

// The dev/E2E bypass identities in lib/amplify-server.ts present a made-up sub
// ("dev-bypass-...") for a row that is seeded under the real Cognito sub, so a
// bypass sign-in has to be allowed to adopt its row by email. Only that branch
// of getServerSession ever produces such a sub, and only in development.
const BYPASS_SUB_PREFIX = "dev-bypass-";

type ResolvedUser = { id: string; email: string; name: string | null };

/** What resolveUserRow needs from a verified Cognito session. */
export type SessionIdentity = {
  sub: string;
  email?: string | null;
  /** True only when Cognito has verified the email (see native-api-auth.ts). */
  emailTrusted?: boolean;
  name?: string;
};

/**
 * Resolve a verified Cognito session to its Prisma User row, provisioning one
 * on first sight. Returns null when the session may not use the app.
 *
 * A row is matched by `sub` first. Matching by email (adopting a guest row, or
 * creating a row that claims the address) needs an email Cognito has verified:
 * otherwise anyone could claim an address they do not own and receive what is
 * sent or granted to it later. A row already bound to a different real sub
 * means the pre sign-up trigger did not link the identities, so taking it over
 * here would be an account takeover, not a sign-in.
 *
 * Banned accounts resolve to null, so every surface built on a user session
 * refuses them.
 */
export async function resolveUserRow(identity: SessionIdentity): Promise<ResolvedUser | null> {
  const { sub, name } = identity;
  const select = { id: true, email: true, name: true, isBanned: true } as const;

  const bySub = await prisma.user.findUnique({ where: { cognitoSub: sub }, select });
  if (bySub) return bySub.isBanned ? null : withoutBan(bySub);

  const email = identity.email ?? "";
  const isBypass = sub.startsWith(BYPASS_SUB_PREFIX);

  if (!email) {
    return prisma.user.create({
      data: { cognitoSub: sub, email: sub, name },
      select: { id: true, email: true, name: true },
    });
  }

  if (!identity.emailTrusted && !isBypass) return null;

  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, cognitoSub: true, isBanned: true },
  });

  if (byEmail?.isBanned) return null;
  const claimed = byEmail?.cognitoSub;
  if (byEmail && claimed && claimed !== sub && !isBypass) return null;

  // Dev bypass identities adopt the seeded row, including re-pointing its sub.
  if (isBypass) {
    return prisma.user.upsert({
      where: { email },
      update: { cognitoSub: sub },
      create: { cognitoSub: sub, email, name },
      select: { id: true, email: true, name: true },
    });
  }

  // The read above is not the write. Two verified sign-ins for the same email
  // can both see an unbound row; only a conditional update may bind it, and a
  // ban that lands in between is not returned as a session.
  return claimEmail(sub, email, name);
}

async function claimEmail(
  sub: string,
  email: string,
  name: string | undefined,
): Promise<ResolvedUser | null> {
  const claimed = await prisma.user.updateMany({
    where: {
      email,
      isBanned: false,
      OR: [{ cognitoSub: null }, { cognitoSub: sub }],
    },
    data: { cognitoSub: sub },
  });
  if (claimed.count === 1) return readClaimed(email, sub);

  try {
    return await prisma.user.create({
      data: { cognitoSub: sub, email, name },
      select: { id: true, email: true, name: true },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }

  // The other sign-in created or bound the row first. Take it only if it is
  // still unbound (or already ours) and not banned.
  const again = await prisma.user.updateMany({
    where: {
      email,
      isBanned: false,
      OR: [{ cognitoSub: null }, { cognitoSub: sub }],
    },
    data: { cognitoSub: sub },
  });
  if (again.count !== 1) return null;
  return readClaimed(email, sub);
}

async function readClaimed(email: string, sub: string): Promise<ResolvedUser | null> {
  const row = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isBanned: true, cognitoSub: true },
  });
  if (!row || row.isBanned || row.cognitoSub !== sub) return null;
  return withoutBan(row);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

function withoutBan(user: ResolvedUser & { isBanned: boolean }): ResolvedUser {
  return { id: user.id, email: user.email, name: user.name };
}
