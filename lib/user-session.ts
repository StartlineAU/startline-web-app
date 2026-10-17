import prisma from "@/lib/prisma";

// The dev/E2E bypass identities in lib/amplify-server.ts present a made-up sub
// ("dev-bypass-...") for a row that is seeded under the real Cognito sub, so a
// bypass sign-in has to be allowed to adopt its row by email. Only that branch
// of getServerSession ever produces such a sub.
const BYPASS_SUB_PREFIX = "dev-bypass-";

type ResolvedUser = { id: string; email: string; name: string | null };

/**
 * Resolve a verified Cognito session to its Prisma User row, provisioning one
 * on first sight.
 *
 * A row is matched by `sub` first. When it is only found by email it is adopted
 * only if it has no sub yet, or the caller is a dev bypass identity. A row
 * already bound to a different real sub means the pre sign-up trigger did not
 * link the identities, so taking it over here would be an account takeover, not
 * a sign-in — this returns null instead.
 */
export async function resolveUserRow(
  sub: string,
  email: string | null | undefined,
  name?: string,
): Promise<ResolvedUser | null> {
  const select = { id: true, email: true, name: true } as const;

  const bySub = await prisma.user.findUnique({ where: { cognitoSub: sub }, select });
  if (bySub) return bySub;

  if (email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true, cognitoSub: true },
    });

    const claimed = byEmail?.cognitoSub;
    const isBypass = sub.startsWith(BYPASS_SUB_PREFIX);
    if (byEmail && claimed && claimed !== sub && !isBypass) {
      return null;
    }

    return prisma.user.upsert({
      where: { email },
      update: { cognitoSub: sub },
      create: { cognitoSub: sub, email, name },
      select,
    });
  }

  return prisma.user.create({
    data: { cognitoSub: sub, email: sub, name },
    select,
  });
}
