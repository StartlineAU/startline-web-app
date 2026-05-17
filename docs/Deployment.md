# Deployment & CI/CD

How code and infrastructure changes flow from a feature branch to production.

## Branches

| Branch | Purpose | What deploys |
|---|---|---|
| `main` | Source of truth for app code AND terraform | Terraform applies (no app deploy) |
| `non-production` | Staging — features tested live | Amplify nonprod environment |
| `production` | Live — real users | Amplify prod environment (startlineau.com) |
| `feature/*`, `fix/*`, `claude/*`, etc. | Work branches | Nothing |

`main` is *not* an Amplify deploy branch. Code on `main` only goes live after it's promoted into `non-production` or `production`. Terraform changes, however, do apply at merge-to-main.

## Environments

Each environment is independently provisioned by terraform via `module.env[*]` (see [`terraform/main.tf`](terraform/main.tf) `local.environments`).

| Resource | prod | nonprod |
|---|---|---|
| Amplify branch | `production` | `non-production` |
| Amplify stage | PRODUCTION | DEVELOPMENT |
| RDS instance | `startline-prod-postgres` | `startline-nonprod-postgres` |
| Postgres `db_name` | `startline_prod` | `startline_nonprod` |
| VPC CIDR | `10.20.0.0/16` | `10.21.0.0/16` |
| Cognito user pool | `startline-prod-users` | `startline-nonprod-users` |
| Custom domain | startlineau.com (apex + www) | none — uses default `*.amplifyapp.com` |
| RDS deletion protection | on | off |
| Cognito deletion protection | on | off |
| Final snapshot on destroy | yes | no |

Shared singletons (one for the whole project, not per-env):

- Amplify app (the two branches above attach to it)
- IAM roles (Amplify execution role, terraform CI role)
- Route 53 hosted zone for `startlineau.com`
- S3 bucket holding terraform state
- GitHub OIDC trust (lets Actions assume the CI role)

## Promotion flow

```
feature branch
    │  PR + green CI + review
    ▼
   main ──────────────────► terraform-apply runs (if terraform/** changed)
    │  merge main → non-production
    ▼
non-production ────────────► Amplify deploys nonprod env
    │  merge non-production → production after QA
    ▼
production ────────────────► Amplify deploys prod env (startlineau.com)
```

Changes always flow downstream — `feature` → `main` → `non-production` → `production`. Never the other way.

### Resetting non-production

If non-production gets messy from in-flight feature testing and you want to scrap it:

```bash
git checkout non-production
git fetch origin
git reset --hard origin/production
git push --force-with-lease origin non-production
```

This makes nonprod identical to prod again. Amplify will redeploy.

## CI workflows

Two GitHub Actions live in [`.github/workflows/`](.github/workflows/):

### `terraform-plan.yml`

- **Trigger:** PR targeting `main` when `terraform/**` or `.github/workflows/terraform-*.yml` change
- **Steps:** `terraform fmt -check`, `validate`, `plan`, posts the plan as a PR comment
- **Side effects:** none. Purely informational.

### `terraform-apply.yml`

- **Trigger:** push to `main` when `terraform/**` or `.github/workflows/terraform-*.yml` change
- **Steps:** `terraform apply -auto-approve`
- **Side effects:** real AWS resources change.

Both workflows authenticate via OIDC, assuming the `startline-terraform-ci` IAM role created by [`terraform/github_oidc.tf`](terraform/github_oidc.tf). The role ARN is exposed as a repo variable `vars.AWS_ROLE_ARN`. Sensitive values (Amplify GitHub PAT, Resend API key) come from repo secrets:

| Repo variable / secret | Used for |
|---|---|
| `vars.AWS_ROLE_ARN` | Both workflows assume this role |
| `secrets.AMPLIFY_REPOSITORY_ACCESS_TOKEN` | Amplify connecting to the GitHub repo |
| `secrets.RESEND_API_KEY` | Transactional email |

## What triggers what

| Action | Result |
|---|---|
| Open PR against `main` (terraform changed) | `terraform-plan` runs, posts PR comment |
| Merge PR to `main` (terraform changed) | `terraform-apply` runs, infra updates |
| Merge PR to `main` (only app code changed) | Nothing — wait for promotion to deploy |
| Push to `non-production` | Amplify rebuilds & deploys nonprod |
| Push to `production` | Amplify rebuilds & deploys prod |

Terraform applies on `main` only. Application deploys happen on `non-production` / `production` only. They're decoupled: terraform manages environment shape; Amplify deploys app code into it.

### Subtle ordering

If a terraform change updates a branch-level env var (e.g. `DATABASE_URL`), `terraform-apply` on `main` updates Amplify's stored env var, but **Amplify won't rebuild the branch until the next code push**. To pick up the new env var immediately, either push something to the branch or click "Redeploy this version" in the Amplify console.

If a feature needs a new env var or other infra change, the order is:

1. Merge the terraform change to `main` first → apply runs.
2. Then promote app code through `non-production` → `production`.

The standard flow gives you this for free: `terraform-apply` runs at merge-to-main, well before code reaches a deploy branch.

## Local terraform workflow

You generally shouldn't run `terraform apply` locally — let CI do it. But for previewing:

```bash
cd terraform
terraform init
terraform plan    # shows what would change
```

Visualize a plan as an interactive graph:

```bash
brew install im2nguyen/tap/rover
cd terraform
rover -tfPath $(which terraform)   # opens localhost:9000
```

You'll need AWS credentials in your shell and a `terraform.tfvars` with sensitive values (`amplify_repository_access_token`, `resend_api_key`). See [`terraform/terraform.tfvars.example`](terraform/terraform.tfvars.example).

## Branch protections

These aren't yet enforced but should be configured in GitHub repo settings:

- **`main`** — require PR + green CI before merge; no direct pushes.
- **`non-production`** — require PR; source must be `main`.
- **`production`** — require PR; source must be `non-production`; no force-push.

## Disaster recovery

| Scenario | Action |
|---|---|
| Bad code in prod | Revert the offending commit on `main`, then promote `main` → `non-production` → `production` |
| Bad nonprod state | `git reset --hard origin/production && git push --force-with-lease` (see above) |
| Bad terraform apply | Revert the merge commit on `main`; CI applies the revert |
| Need to roll forward fast | Push directly to `production` is technically possible if no protection is set, but always prefer the promotion flow |
| RDS data loss | Restore from RDS automated backup (when `database_backup_retention_period > 0`) or from a manual export |
