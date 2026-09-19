import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireOrganiser } from "@/lib/organiser-api-auth";
import prisma from "@/lib/prisma";
import { organiserUrl } from "@/lib/portal-domains";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const GENERIC_ERROR = "Failed to create Stripe onboarding link.";

// Stripe's answer when the stored account id is not one this platform key can
// see: deleted, or created under the other mode's key (test vs live). Retrying
// with that id can never succeed, so the organiser would be stuck for good.
const STALE_ACCOUNT_CODES = new Set(["resource_missing", "account_invalid"]);

function stripeErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

// Logged in full because the organiser only ever sees the generic message, and
// without the Stripe code and request id nobody can tell a platform setup
// problem from a bad account (issue #322).
function logStripeError(step: string, err: unknown) {
  const e = err as
    | { type?: string; code?: string; param?: string; requestId?: string; message?: string }
    | undefined;
  console.error(`Stripe connect error (${step}):`, {
    type:      e?.type,
    code:      e?.code,
    param:     e?.param,
    requestId: e?.requestId,
    message:   e?.message ?? String(err),
  });
}

async function createExpressAccount(stripe: Stripe, email: string) {
  return stripe.accounts.create({
    type:    "express",
    country: "AU",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers:     { requested: true },
    },
    business_type: "individual",
    settings: {
      payouts: {
        schedule: { interval: "manual" },
      },
    },
  });
}

function createOnboardingLink(stripe: Stripe, accountId: string) {
  return stripe.accountLinks.create({
    account:     accountId,
    refresh_url: organiserUrl("/organiser/payments?refresh=1", SITE),
    return_url:  organiserUrl("/organiser/payments/return", SITE),
    type:        "account_onboarding",
  });
}

export async function POST() {
  const auth = await requireOrganiser();
  if (auth.error) return auth.error;
  const session = auth.session;

  // Checked up front rather than left to getStripe() to throw, so a deployment
  // without the key says so instead of looking like a Stripe outage.
  if (!isStripeConfigured()) {
    console.error("Stripe connect error: STRIPE_SECRET_KEY is not set on this environment.");
    return NextResponse.json(
      { error: "Payments are not available yet. Please contact Startline support." },
      { status: 503 },
    );
  }

  const stripe = getStripe();

  const organiser = await prisma.organiser
    .findUnique({
      where:  { id: session.sub },
      select: { stripeAccountId: true, email: true },
    })
    .catch((err: unknown) => {
      console.error("Stripe connect error (organiser lookup):", err);
      return undefined;
    });

  if (organiser === undefined) return NextResponse.json({ error: GENERIC_ERROR }, { status: 503 });
  if (!organiser) return NextResponse.json({ error: "Organiser not found." }, { status: 404 });

  const newAccount = async () => {
    const account = await createExpressAccount(stripe, organiser.email);
    await prisma.organiser.update({
      where: { id: session.sub },
      data:  { stripeAccountId: account.id, stripeOnboardingComplete: false },
    });
    return account.id;
  };

  let accountId: string;
  try {
    accountId = organiser.stripeAccountId ?? (await newAccount());
  } catch (err) {
    logStripeError("create account", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 503 });
  }

  try {
    const link = await createOnboardingLink(stripe, accountId);
    return NextResponse.json({ url: link.url });
  } catch (err) {
    const stale = organiser.stripeAccountId !== null && STALE_ACCOUNT_CODES.has(stripeErrorCode(err) ?? "");
    logStripeError(stale ? "stale account, replacing" : "account link", err);
    if (!stale) return NextResponse.json({ error: GENERIC_ERROR }, { status: 503 });
  }

  // The stored account is unusable. Replace it once and try again.
  try {
    const link = await createOnboardingLink(stripe, await newAccount());
    return NextResponse.json({ url: link.url });
  } catch (err) {
    logStripeError("replace account", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 503 });
  }
}
