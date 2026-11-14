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

  return prisma.user.upsert({
    where: { email },
    update: { cognitoSub: sub },
    create: { cognitoSub: sub, email, name },
    select: { id: true, email: true, name: true },
  });
}

function withoutBan(user: ResolvedUser & { isBanned: boolean }): ResolvedUser {
  return { id: user.id, email: user.email, name: user.name };
}
