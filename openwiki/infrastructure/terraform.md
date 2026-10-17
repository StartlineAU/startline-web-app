---
type: Reference
title: Infrastructure & CI/CD
description: Terraform-managed AWS infrastructure for Startline — including Neon-managed Postgres, Cognito, Amplify hosting, GitHub Actions CI/CD, and secrets management.
tags: [startline, infrastructure, terraform, aws, amplify, neon, ci-cd, deployments]
resource: StartlineAU/startline-infra
---

# Infrastructure & CI/CD

Startline's infrastructure is fully defined in **Terraform** with a unified state, deployed via GitHub Actions. The infrastructure lives in the separate **`StartlineAU/startline-infra`** repo; the web-app stack is at `startline-web-app/`. The application is hosted on **AWS Amplify** with per-environment Postgres databases on **Neon** and Cognito pools.

## Infrastructure Overview

- **Terraform state**: Unified, single state file (S3 key `startline/terraform.tfstate`). The stack moved out of this repo without changing the key, so resources were not recreated.
- **Root module** (`startline-web-app/main.tf`): Amplify app, IAM roles, Route 53 DNS, Cloudflare DNS, ACM certificates
- **Environment module** (`startline-web-app/modules/environment/`): Per-environment Amplify branch, Cognito user pool, uploads bucket
- **Neon** (`startline-web-app/neon.tf`): Two `neon_project` resources (`startline-prod`, `startline-staging`, Sydney, Postgres 16) managed via the `kislerdm/neon` provider; connection strings flow to the Amplify branch `DATABASE_URL`
- **Two environments**: `prod` and `staging` (defined in `main.tf` → `local.environments`)

## Terraform Structure

| File | Purpose |
|---|---|
| `startline-web-app/main.tf` | Root module — Amplify app, IAM roles, build spec, environment module instances |
| `startline-web-app/neon.tf` | Neon `neon_project` resources (prod + staging Postgres) + provider |
| `startline-web-app/modules/environment/main.tf` | Amplify branch, Cognito, uploads bucket |
| `startline-web-app/dns.tf` | Cloudflare DNS records for apex and subdomains |
| `startline-web-app/cloudflare-dns.tf` | Additional Cloudflare DNS resources |
| `startline-web-app/acm.tf` | ACM certificates |
| `startline-web-app/github_oidc.tf` | GitHub OIDC provider and IAM roles for CI/CD |
| `startline-web-app/iam-policies.tf` | Custom IAM policies for Amplify, CI/CD |
| `startline-web-app/iam-users.tf` | IAM users (if needed) |
| `startline-web-app/state.tf` | S3 backend for Terraform state |
| `startline-web-app/variables.tf` | Input variables |
| `startline-web-app/outputs.tf` | Output values |
| `startline-web-app/providers.tf` | Provider configuration |
| `startline-web-app/versions.tf` | Terraform and provider version constraints |

The repo root still holds the unrelated docs stack (Outline droplet, docs Cognito).

## CI/CD Pipelines

### Terraform Workflows (`startline-infra`)

| Workflow | Trigger | Scope |
|---|---|---|
| `terraform-plan.yml` | PR touching `startline-web-app/**` | `terraform fmt -check` + `terraform validate`, no AWS credentials. A full plan needs the secret-bearing state, so it runs on the trusted apply path instead |
| `terraform-apply.yml` | `workflow_dispatch`, or `main` when `TF_AUTO_APPLY=true` | Plans and applies, admin role, protected branches only |

Apply is manual until the first apply has been reviewed. Set `TF_AUTO_APPLY=true` in `startline-infra` to restore apply-on-merge. It is currently `true`, so a push to `main` applies the stack — which is why the infra repo needs branch protection (or auto-apply off) while it is private.

### Application Workflows (this repo)

| Workflow | Trigger | Scope |
|---|---|---|
| `ci.yml` | PR to `main` | Gitleaks secret scan, lint, typecheck, build, test, e2e (all blocking) |
| `deploy.yml` | Push to `main` or `prod` | Amplify build + deploy, GitHub Deployments API |

### OpenWiki Workflow

| Workflow | Trigger | Scope |
|---|---|---|
| (external) | Scheduled or manual | Regenerates `openwiki/` docs from this repo and refreshes the wiki. Docs are also hand-maintained in `openwiki/`.

## Environments

| Environment | Branch | Amplify Build Behavior |
|---|---|---|
| `prod` | `prod` | Migrate DB, no seed |
| `staging` | `main` | Migrate DB, no seed |
| PR to `main` | Preview (staging) | Inherits staging resources, auth bypass |
| PR to `prod` | Preview (prod) | Inherits prod resources, auth bypass |

Neither environment seeds on deploy. `prisma db seed` truncates every table
and resets the shared Cognito seed passwords, so it is gated behind the
`SEED_DATABASE` branch variable (set it to `"true"` in the Amplify console
for a deliberate reseed, then set it back). The seed itself also refuses any
non-local `DATABASE_URL` unless `ALLOW_REMOTE_SEED=true`. A failed migration
now fails the build rather than falling back to `migrate reset --force`,
which used to drop the database.

`SEED_DATABASE` is Terraform-managed and pinned to `"false"`, so a console
flip lasts only until the next `terraform apply` resets it. Do the reseed and
flip it back in the same sitting.

The `ENV` env var is set per Amplify branch (`prod` → `prod`, `main` → `staging`). PR previews inherit the target branch's `ENV` value. The build spec uses `$ENV` to select the correct Secrets Manager secret.

## Runtime vs build-time variables

The build writes `startline/$ENV/app` into `.env.production`, but the app is
built with `output: "standalone"` and Amplify ships only `.next`, so that file
never reaches the running server. Secrets Manager is therefore build-time only:
`NEXT_PUBLIC_*` works (Next inlines it at build), and anything read at runtime
must be an Amplify **branch** environment variable set in
`startline-infra/startline-web-app/modules/environment/main.tf`.

Terraform owns the whole branch variable map, so console-added values are
deleted on the next apply — and it owns only the *generated* half of the app
secret (Cognito ids, Neon URL, bucket, CDN, site URL, the two generated
secrets). The credential keys are owned by the app secret itself: Terraform
reads the secret and merges the generated keys over the top, so
`startline/automation` is no longer their source. A prod apply fails a
precondition rather than silently clearing one that is missing.

To rotate a runtime credential, set it on `startline/prod/app` or
`startline/staging/app` and rebuild that branch. The keys an environment owns
are `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ACCOUNT_EVENTS_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM` and
`ABR_GUID`.

## Secrets Management

All secrets are stored in **AWS Secrets Manager** and never committed to the repository:

| Secret | Contents |
|---|---|
| `startline/automation` | Trusted CI/Terraform credentials: Amplify PAT, Cloudflare token, Neon API key/org, DigitalOcean token, Cognito social sign-in secrets. Not app runtime config |
| `startline/prod/app` | Production runtime config (Cognito, Stripe live keys, Postgres, S3/CDN, Resend, ABR). Terraform owns the generated keys and preserves the credential keys |
| `startline/staging/app` | Staging env vars (non-production Cognito, Neon, S3) |
| `startline/docs` | Outline documentation server only |

**Who may read what.** PR workflows read no AWS secret: anything a PR can read,
unmerged PR code can read, and Secrets Manager grants a whole JSON secret rather
than single fields. `startline/automation` and the app secrets are read only by
workflows on protected branches. The one PR-time credential, the Gitleaks
license, is a repository secret. There is no PR-capable read-only IAM role.

**Loading mechanism**: `.envrc` (gitignored) + direnv fetches the appropriate secret and exports to the shell. In trusted CI, the composite action at `.github/actions/load-env/` assumes an OIDC role and exports whitelisted keys.

**Key rotation**: Update the secret in AWS Secrets Manager and trigger an Amplify rebuild — no code or Terraform changes needed.

## Related

- [Architecture](/openwiki/architecture/overview.md) — how the app is hosted and routed
- [Auth System](/openwiki/auth/overview.md) — Cognito user pool configuration
- [Payments](/openwiki/payments/overview.md) — Stripe configuration
