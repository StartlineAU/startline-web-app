import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/amplify-server";
import {
  getSignInMethods,
  SignInMethodError,
  unlinkProvider,
  verifyAuthenticatorStepUp,
} from "@/lib/cognito-sign-in-methods";
import { requireAccountProof } from "@/lib/account-proof";
import { getSessionSignInMethods } from "@/lib/session-sign-in-methods";
import {
  createLinkRequest,
  LINK_COOKIE_MAX_AGE,
  LINK_COOKIES,
  signLinkGrant,
} from "@/lib/cognito-oauth";
import { safeReturnTo, type SignInMethods } from "@/lib/sign-in-methods";
import { enabledSocialProviders } from "@/lib/social-providers";

// Only read when the account has an authenticator app; see requireStepUp.
const proofFields = {
  password: z.string().min(1).max(256).optional(),
  code: z.string().regex(/^\d{6}$/).optional(),
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    provider: z.enum(["google", "apple"]),
    returnTo: z.string().max(500).optional(),
    ...proofFields,
  }),
  z.object({
    action: z.literal("unlink"),
    provider: z.enum(["google", "apple"]),
    ...proofFields,
  }),
]);

function unavailable() {
  return NextResponse.json(
    { error: "Sign-in methods cannot be managed in this environment." },
    { status: 501 },
  );
}

function errorResponse(error: unknown) {
  if (error instanceof SignInMethodError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("Sign-in methods request failed:", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

// An account with an authenticator app needs the password and a current code to
// link or unlink. Google and Apple can't be asked for the code, so this check is
// the only one there is for those changes.
async function requireStepUp(
  username: string,
  methods: SignInMethods,
  body: { password?: string; code?: string },
): Promise<void> {
  if (!methods.mfaRequired) return;
  if (!body.password || !body.code) {
    throw new SignInMethodError(
      "step-up-required",
      400,
      "Enter your password and a code from your authenticator app.",
    );
  }
  await verifyAuthenticatorStepUp({ username, password: body.password, code: body.code });
}

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const methods = await getSessionSignInMethods(session);
  if (!methods) return unavailable();
  return NextResponse.json(methods);
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (!session.username) return unavailable();

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const body = parsed.data;
  const enabled = enabledSocialProviders();

  try {
    if (body.action === "unlink") {
      const current = await getSignInMethods(session.username, enabled);
      if (!current.hasPassword) {
        return NextResponse.json(
          {
            error: "Set a password before disconnecting a sign-in method.",
            code: "password-required",
          },
          { status: 409 },
        );
      }
      await requireStepUp(session.username, current, body);

      const methods = await unlinkProvider({
        username: session.username,
        provider: body.provider,
        enabledProviders: enabled,
      });
      return NextResponse.json(methods);
    }

    if (!enabled.includes(body.provider)) {
      return NextResponse.json(
        { error: "That sign-in provider is not available on this deployment.", code: "not-enabled" },
        { status: 400 },
      );
    }

    const current = await getSignInMethods(session.username, enabled);
    // Linking adds a way into the account that survives a password change and
    // signing out everywhere, so a session alone (which may be stolen) is not
    // enough.
    await requireAccountProof(session, current, body);

    const request = createLinkRequest(body.provider, new URL(req.url).origin);
    if (!request) return unavailable();

    // The callback links only when this grant comes back with the request, so
    // cookies set by hand cannot skip the proof above.
    const grant = signLinkGrant({ state: request.state, sub: session.sub, provider: body.provider });
    if (!grant) return unavailable();

    const response = NextResponse.json({ url: request.url });
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LINK_COOKIE_MAX_AGE,
    };
    response.cookies.set(LINK_COOKIES.state, request.state, cookieOptions);
    response.cookies.set(LINK_COOKIES.verifier, request.verifier, cookieOptions);
    response.cookies.set(LINK_COOKIES.provider, body.provider, cookieOptions);
    response.cookies.set(LINK_COOKIES.returnTo, safeReturnTo(body.returnTo), cookieOptions);
    if (grant) response.cookies.set(LINK_COOKIES.grant, grant, cookieOptions);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
