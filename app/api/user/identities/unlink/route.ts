import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/amplify-server";
import {
  canUnlinkProvider,
  getAccountSignInState,
  providerLabel,
  unlinkProvider,
  type SignInProvider,
} from "@/lib/account-sign-in";
import { describeCognitoError } from "@/lib/cognito-user";

const unlinkSchema = z.object({
  provider: z.enum(["google", "apple"]),
});

// POST /api/user/identities/unlink
// Detaches one provider from the current Cognito profile. A password must
// already be set, so removing the provider cannot lock the person out.
//
// AdminDisableProviderForUser needs IAM credentials. The Amplify app role's
// AdministratorAccess-Amplify policy does not include it, so startline-infra
// must grant cognito-idp:AdminDisableProviderForUser on the user pool ARN.
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (session.bypass) return NextResponse.json({ error: "No Cognito session." }, { status: 401 });

  const parsed = unlinkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const provider = parsed.data.provider as SignInProvider;

  const state = await getAccountSignInState(session);
  if (!state) {
    return NextResponse.json({ error: "Could not read your sign-in methods." }, { status: 503 });
  }
  if (!state.hasPassword) {
    return NextResponse.json(
      { error: "Set a password before unlinking a sign-in method." },
      { status: 409 },
    );
  }
  if (!canUnlinkProvider(state, provider)) {
    return NextResponse.json(
      { error: `${providerLabel(provider)} is not linked to this account.` },
      { status: 404 },
    );
  }

  const identity = state.identities.find((item) => item.provider === provider);
  if (!identity) {
    return NextResponse.json(
      { error: `${providerLabel(provider)} is not linked to this account.` },
      { status: 404 },
    );
  }

  try {
    await unlinkProvider(session, identity);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && (err.name === "NotAuthorizedException" || err.name === "AccessDeniedException")) {
      console.error("Cognito AdminDisableProviderForUser failed:", err);
      return NextResponse.json(
        { error: "Could not unlink that sign-in method. Please try again." },
        { status: 500 },
      );
    }
    const { status, error } = describeCognitoError(err);
    return NextResponse.json({ error }, { status });
  }
}
