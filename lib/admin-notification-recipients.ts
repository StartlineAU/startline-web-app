import {
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const region = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const client = new CognitoIdentityProviderClient({ region });

const ADMIN_GROUP = "admins";

// RFC 2606 / 6761 names that can never receive mail. The seed creates its
// admins on @startline.test, and staging's database holds them, so sending to
// every admin in the group there would bounce and hurt the sender's reputation.
const UNDELIVERABLE_TLDS = [".test", ".example", ".invalid", ".localhost"];

/** Deliverable, de-duplicated admin addresses. */
export function adminReviewRecipients(emails: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const raw of emails) {
    const email = raw?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (UNDELIVERABLE_TLDS.some((tld) => email.endsWith(tld))) continue;
    seen.add(email);
  }
  return [...seen];
}

type AdminGroupUser = {
  Enabled?: boolean;
  Attributes?: { Name?: string; Value?: string }[];
};

/**
 * Email addresses of the current members of the Cognito `admins` group
 * (issue #337). Group membership is the source of truth, so a new admin gets
 * review alerts before their first admin-portal sign-in has created an Admin
 * row. Disabled accounts are skipped.
 */
export async function listAdminReviewRecipients(): Promise<string[]> {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
  if (!userPoolId) {
    console.warn("NEXT_PUBLIC_COGNITO_USER_POOL_ID not configured — skipping admin email notification");
    return [];
  }

  try {
    const emails: (string | undefined)[] = [];
    let nextToken: string | undefined;

    do {
      const page = await client.send(
        new ListUsersInGroupCommand({
          UserPoolId: userPoolId,
          GroupName: ADMIN_GROUP,
          NextToken: nextToken,
        }),
      );

      for (const user of (page.Users ?? []) as AdminGroupUser[]) {
        if (user.Enabled === false) continue;
        const email = user.Attributes?.find((attribute) => attribute.Name === "email")?.Value;
        if (email) emails.push(email);
      }

      nextToken = page.NextToken;
    } while (nextToken);

    return adminReviewRecipients(emails);
  } catch (err) {
    // The event still saves or the review still reports; only this alert is lost.
    console.error("Cognito admin recipient lookup failed:", err);
    return [];
  }
}
