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

export async function createConnectedAccount(stripe: Stripe, email: string): Promise<Account> {
  return stripe.v2.core.accounts.create({
    contact_email: email,
    dashboard:     "express",
    identity:      { country: "AU", entity_type: "individual" },
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

export async function retrieveConnectStatus(stripe: Stripe, accountId: string): Promise<ConnectStatus> {
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: [...INCLUDE] });
  return connectStatusFromAccount(account);
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
