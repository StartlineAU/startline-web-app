---
type: Reference
title: Payments — Stripe Connect & Platform Fees
description: Stripe Connect Express integration for the Startline platform — organiser payouts, platform fee calculation, checkout flow, and capacity management.
tags: [startline, payments, stripe, connect-express, platform-fee, checkout]
resource: /lib/stripe.ts
---

# Payments

Startline uses **Stripe Connect Express** for organiser payouts. Athletes pay via Stripe PaymentIntents, and platform fees are collected as part of each transaction.

## Stripe Configuration

- **API version**: `2026-05-27.dahlia` (set in `/lib/stripe.ts`)
- **Singleton client**: `getStripe()` returns a cached `Stripe` instance
- **Secret key**: `STRIPE_SECRET_KEY` environment variable

## Platform Fee

Defined in `/lib/platform-fee.ts`:

- **Rate**: 3.95% + $1.45 AUD per registration (flat fee)
- **Fee structure**: The `feeStructure` field on `Event` and `Registration` determines who pays:
  - `"athlete"` — fee is added on top of the ticket price (default)
  - `"organiser"` — fee is deducted from the organiser's payout
- All money is handled in **integer cents** (AUD)

## Checkout Flow

The checkout API at `/app/api/checkout/route.ts`:

1. Validates the event exists and is open for registration
2. Normalises participant data (single or group)
3. Validates age (18+), required fields, and emergency contact
4. Checks capacity against event cap and per-tier (wave) limits
5. Verifies guest emails if the athlete is not logged in
6. Calculates pricing: ticket sum + platform fee per participant
7. Creates Stripe PaymentIntent and Prisma Registration records
8. Returns client secret for Stripe Elements to confirm payment

Supports:
- **Single registration**: One participant, direct form fields
- **Group registration**: Up to 10 participants (`MAX_REGISTRATION_PARTICIPANTS`), optional shared emergency contact, mixed ticket tiers

## Stripe Connect (Accounts v2, Express dashboard)

- Organisers get a Stripe connected account during onboarding, created with Accounts v2 (`lib/stripe-connect.ts`). Older accounts created with v1 keep working unchanged
- Onboarding status comes from v2 capability statuses (card payments, transfers, payouts), checked by `/api/organiser/stripe/status` and by the v2 event destination at `/api/stripe/account-events`
- Payouts are manual (set through balance settings) and sent per event by `lib/payout.ts`
- Startline stores only the `stripeAccountId` reference — bank details are held by Stripe (ToS §3.3)
- `stripeOnboardingComplete` flag tracks whether the organiser finished onboarding
- Payouts flow through Connect to the organiser's bank account

## Registration Capacity

Capacity is checked at checkout time in `/lib/registration-capacity.ts`:

- **Event cap**: Overall limit across all tiers
- **Wave (tier) caps**: Per-ticket-tier limits
- Only **confirmed (paid)** registrations count toward capacity
- A race condition exists for concurrent in-flight payments near the cap — no reservation/hold system is currently implemented

## Related

- [Domain & Data Model](/openwiki/domain/data-model.md) — Registration, Event, and Organiser entities
- [Architecture](/openwiki/architecture/overview.md) — how the checkout API fits in the portal structure
