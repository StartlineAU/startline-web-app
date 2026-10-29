# Security Policy

Startline is a fitness event discovery and registration platform. This policy
covers the web application in this repository and the three portals it serves:

- `startlineau.com` — public event browsing
- `organiser.startlineau.com` — organiser portal
- `admin.startlineau.com` — admin portal

## Supported versions

There are no numbered releases. The application is deployed continuously from a
branch, so the only supported version is what is currently running in
production.

| Deployment | Branch | Supported |
| --- | --- | --- |
| Production (`startlineau.com`, `organiser.`, `admin.`) | `prod` | :white_check_mark: |
| Staging | `main` | :x: |
| Older commits, forks, self-hosted copies | — | :x: |

Staging runs against non-production credentials and data, so findings there are
only useful if they also reproduce in production (or would, once deployed).
Security fixes land on `main` and are promoted to `prod`.

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for a security
problem.** Report it privately instead.

**Preferred — GitHub private vulnerability reporting:**

https://github.com/StartlineAU/startline-web-app/security/advisories/new

This opens a private advisory visible only to you and the maintainers, and is
the fastest route to a fix.

**Alternative — email:** `admin@startlineau.com` with the subject
`Security report`. Encrypt nothing sensitive beyond what is needed to
demonstrate the issue.

Please include:

- The affected URL, endpoint, or component.
- Steps to reproduce, ideally with a proof of concept, request, or screenshot.
- The impact you believe it has (data exposed, actions possible, accounts
  affected).
- Whether you would like to be credited, and under what name.

## What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement of your report | 3 business days |
| Initial assessment and severity | 10 business days |
| Status updates while the report is open | At least every 10 business days |
| Fix for a critical or high severity issue | As soon as practicable; we will give you a date once triaged |

If a report is **accepted**, we will confirm the impact, fix it, and publish a
GitHub security advisory once a fix is deployed. You will be credited in the
advisory unless you ask us not to be.

If a report is **declined**, we will explain why — for example, it is out of
scope, depends on a compromised account or device, or the behaviour is intended.
We may still fix it without treating it as a security issue.

There is no bug bounty and no monetary reward. We are a small team and we
appreciate the time a good report takes.

## Scope

In scope:

- Authentication, session handling, and authorisation boundaries between
  athletes, organisers, managers, and admins.
- Access to another person's or organisation's data.
- The Stripe Connect onboarding and payment flows, including webhook handling.
- The upload pipeline (`/api/upload/presign`, direct-to-S3 uploads,
  `/api/upload/complete`) and stored file handling.
- Server-side input validation, rate limiting, and bot protection bypasses with
  real impact.
- Secrets, credentials, or personal data exposed in the repository, build
  artefacts, or responses.
- Anything that lets an unauthenticated visitor take an action reserved for a
  signed-in user or an admin.

Out of scope:

- Vulnerabilities in third-party services (AWS/Amplify, Stripe, Cloudflare,
  Amazon Cognito, Resend, Neon). Report those to the provider.
- Volumetric or resource-exhaustion denial of service, and spam or bulk
  registration attempts.
- Social engineering, phishing, or physical attacks against staff.
- Reports produced by an automated scanner with no demonstrated impact, missing
  security headers with no exploit, self-XSS, clickjacking on pages with no
  sensitive action, and issues that only affect unsupported or outdated
  browsers.
- Staging, local development, or preview deployments, unless the issue would
  also affect production.
- Content or policy complaints (event listings, reviews, user conduct). Use the
  in-app report tools or `admin@startlineau.com`.

### While testing

- Use accounts you created yourself. Do not access, modify, or delete another
  person's data, and do not test against real events, entries, or payments.
- Stop as soon as you have enough to demonstrate the issue, and report it. Do
  not establish persistence, pivot to other systems, or exfiltrate more data
  than the minimum needed to prove the finding.
- Do not run automated scans that generate significant traffic against
  production.
- Use Stripe test mode for anything payment-related.

## Safe harbour

We consider security research conducted in good faith under this policy to be
authorised, and we will not pursue legal action or ask a provider to act against
you for it. This does not cover activity that is not in good faith: extortion or
demands for payment, privacy violations, disruption of the service, accessing or
retaining data beyond what is needed to demonstrate a finding, or testing
against accounts and data you do not own.

## Disclosure

We follow coordinated disclosure. Please give us a reasonable window to fix the
issue before publishing details — we aim to have a fix deployed, and a security
advisory published, within 90 days of a confirmed report. If a fix takes longer,
we will tell you why and agree a date with you. You are welcome to publish once
the advisory is out, or earlier if we agree.
