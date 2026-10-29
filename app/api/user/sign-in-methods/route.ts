import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/amplify-server";
import {
  getSignInMethods,
  SignInMethodError,
  unlinkProvider,
} from "@/lib/cognito-sign-in-methods";
import {
  createLinkRequest,
  LINK_COOKIE_MAX_AGE,
  LINK_COOKIES,
} from "@/lib/cognito-oauth";
import { safeReturnTo } from "@/lib/sign-in-methods";
import { enabledSocialProviders } from "@/lib/social-providers";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    provider: z.enum(["google", "apple"]),
    returnTo: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("unlink"),
    provider: z.enum(["google", "apple"]),
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

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (!session.username) return unavailable();

  try {
    const methods = await getSignInMethods(session.username, enabledSocialProviders());
    return NextResponse.json(methods);
  } catch (error) {
    return errorResponse(error);
  }
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

    const request = createLinkRequest(body.provider, new URL(req.url).origin);
    if (!request) return unavailable();

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
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
