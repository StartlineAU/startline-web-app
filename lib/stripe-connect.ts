import type Stripe from "stripe";

/**
 * Organiser Stripe accounts on Accounts v2 (issue #379).
 *
 * New accounts are created with POST /v2/core/accounts. Accounts created
 * earlier through v1 (`type: "express"`) are left where they are: the v2 API
 * reads and links them the same way, and the v1 endpoints the rest of the app
 * uses (payment intents with transfer_data, refunds, payouts, balance settings)
 * accept either kind of id. So there is one code path and no migration.
 *
 * v1 to v2 capability mapping, per Stripe:
 *   card_payments  -> configuration.merchant.capabilities.card_payments
 *   transfers      -> configuration.recipient.capabilities.stripe_balance.stripe_transfers
 *   payouts        -> stripe_balance.payouts (on merchant or recipient)
 */

type Account = Stripe.V2.Core.Account;

// Configurations every organiser account carries. Destination charges need the
// recipient one; merchant matches the card_payments capability v1 requested.
const CONFIGURATIONS = ["merchant", "recipient"] as const;

// v2 returns null for configurations it is not asked to include.
const INCLUDE = ["configuration.merchant", "configuration.recipient", "requirements"] as const;

/**
 * The details the Payments page already asked for, shaped for Stripe so its
 * onboarding opens with them filled in rather than asking a second time. The
 * organiser still reviews and confirms them there; Stripe does the verifying.
 * Fields that cannot be read cleanly are left out for Stripe to collect.
 */
export type IndividualPrefill = {
  given_name?:    string;
  surname?:       string;
  date_of_birth?: { day: number; month: number; year: number };
};

export function individualPrefill(legalName: string | null, dob: string | null): IndividualPrefill {
  const prefill: IndividualPrefill = {};

  // Last word is the surname, the rest the given names. One word is too little
  // to split, so Stripe asks for both.
  const words = (legalName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    prefill.given_name = words.slice(0, -1).join(" ");
    prefill.surname    = words[words.length - 1];
  }

  // Stored as yyyy-mm-dd. Only a real date for someone at least 18 is passed
  // on: anything else Stripe would refuse, so it is left for Stripe to ask.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob ?? "");
  if (m) {
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    const adult = new Date(Date.UTC(year + 18, month - 1, day)).getTime() <= Date.now();
    if (real && adult) prefill.date_of_birth = { day, month, year };
  }

  return prefill;
}

function isEmpty(prefill: IndividualPrefill): boolean {
  return Object.keys(prefill).length === 0;
}

export async function createConnectedAccount(
  stripe: Stripe,
  email: string,
  prefill: IndividualPrefill = {},
): Promise<Account> {
  return stripe.v2.core.accounts.create({
    contact_email: email,
    dashboard:     "express",
    identity: {
      country:     "AU",
      entity_type: "individual",
      ...(isEmpty(prefill) ? {} : { individual: prefill }),
    },
    defaults: {
      currency: "aud",
      // What v1 `type: "express"` implied: the platform pays Stripe's fees and
      // carries negative balances.
      responsibilities: { fees_collector: "application", losses_collector: "application" },
    },
    configuration: {
      merchant:  { capabilities: { card_payments: { requested: true } } },
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
    },
    include: [...INCLUDE],
  });
}

/**
 * Fills in what an existing, unfinished account is still missing. Anything
 * Stripe already holds is left alone: the organiser may have typed it into
 * Stripe's own form, and that is the copy Stripe verifies.
 */
export async function prefillExistingAccount(
  stripe: Stripe,
  accountId: string,
  prefill: IndividualPrefill,
): Promise<void> {
  if (isEmpty(prefill)) return;
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ["identity"] });
  const held = account.identity?.individual;

  const missing: IndividualPrefill = {};
  if (prefill.given_name && !held?.given_name) missing.given_name = prefill.given_name;
  if (prefill.surname && !held?.surname) missing.surname = prefill.surname;
  if (prefill.date_of_birth && !held?.date_of_birth) missing.date_of_birth = prefill.date_of_birth;
  if (isEmpty(missing)) return;

  await stripe.v2.core.accounts.update(accountId, { identity: { individual: missing } });
}

export async function createOnboardingLink(
  stripe: Stripe,
  accountId: string,
  urls: { returnUrl: string; refreshUrl: string },
): Promise<{ url: string }> {
  return stripe.v2.core.accountLinks.create({
    account:  accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: [...CONFIGURATIONS],
        return_url:     urls.returnUrl,
        refresh_url:    urls.refreshUrl,
      },
    },
  });
}

/**
 * Money stays in the organiser's balance until lib/payout.ts sends it after the
 * event. v2 has no payout schedule on the account, so it lives in balance
 * settings. Setting it again is harmless, so callers do it on every connect.
 */
export async function ensureManualPayouts(stripe: Stripe, accountId: string): Promise<void> {
  await stripe.balanceSettings.update(
    { payments: { payouts: { schedule: { interval: "manual" } } } },
    { stripeAccount: accountId },
  );
}

export type ConnectStatus = { chargesEnabled: boolean; payoutsEnabled: boolean };

/**
 * The v2 replacement for `charges_enabled` / `payouts_enabled`. Charging needs
 * both card payments and transfers, because checkout is a destination charge
 * that moves the money to this account.
 */
export function connectStatusFromAccount(account: Account): ConnectStatus {
  const merchant  = account.configuration?.merchant?.capabilities;
  const recipient = account.configuration?.recipient?.capabilities;

  const cardPayments = merchant?.card_payments?.status === "active";
  const transfers    = recipient?.stripe_balance?.stripe_transfers?.status === "active";
  const payouts =
    recipient?.stripe_balance?.payouts?.status === "active" ||
    merchant?.stripe_balance?.payouts?.status === "active";

  return { chargesEnabled: cardPayments && transfers, payoutsEnabled: payouts };
}

export function isOnboardingComplete(status: ConnectStatus): boolean {
  return status.chargesEnabled && status.payoutsEnabled;
}

/**
 * Whether Stripe is waiting on the organiser rather than on itself. Once the
 * onboarding form is submitted, capabilities can sit at "pending" while Stripe
 * verifies identity, and sending the organiser back into onboarding then only
 * shows them the form they already finished (issue #387). Only a requirement
 * the user owes now (currently or past due) counts; eventually_due ones do not
 * hold up charging.
 */
export function actionRequiredFromAccount(account: Account): boolean {
  return (account.requirements?.entries ?? []).some(
    (entry) =>
      entry.awaiting_action_from === "user" &&
      entry.minimum_deadline?.status !== "eventually_due",
  );
}

export type ConnectProgress = ConnectStatus & { actionRequired: boolean };

export async function retrieveConnectStatus(stripe: Stripe, accountId: string): Promise<ConnectProgress> {
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: [...INCLUDE] });
  return { ...connectStatusFromAccount(account), actionRequired: actionRequiredFromAccount(account) };
}

/**
 * v2 account events that can change onboarding status. The event destination
 * that delivers to /api/stripe/account-events subscribes to exactly these.
 */
export const ACCOUNT_EVENT_TYPES = [
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account[requirements].updated",
] as const;
