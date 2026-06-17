# AGENTS.md — Startline

## Architecture

Startline is a Next.js 15 (App Router) fitness event discovery platform with three portals:

- **Customer site** (`(customer)/`) — public event browsing at `startlineau.com`
- **Organiser portal** (`organiser/`) — event management at `organiser.startlineau.com`
- **Admin portal** (`admin/`) — approval workflow, organiser management

### Domain-based routing

`middleware.ts` routes requests by hostname in production:
- `organiser.startlineau.com` → organiser portal (protects `/organiser/dashboard`, `/organiser/listings`, etc.)
- `startlineau.com` → customer site (redirects `/organiser/*` and `/admin/*` to organiser subdomain)
- Dev mode (`NODE_ENV=development`) skips all domain checks — everything runs at `localhost:3000`

### Auth (Cognito)

Uses AWS Cognito with JWT verification in middleware via `jose`. Tokens are stored in Cognito-managed cookies. Admin users are identified by presence of `admin-nonprod-users` Cognito group.

`DEV_BYPASS=true` in `.env` skips all Cognito verification in local dev.

### Database

PostgreSQL 15 via Docker on port **5433** (mapped from container port 5432). Prisma ORM with singleton client in `lib/prisma.ts`.

Mailpit runs alongside PostgreSQL in Docker (SMTP on **1025**, web UI on **8025**) for local email testing.

The app itself runs in Docker via the `app` service (Next.js standalone on port 3000). Prisma Studio runs on-demand via `docker compose exec app npx prisma studio`.

```bash
docker compose up -d              # starts PostgreSQL + Mailpit + app
docker compose exec app npx prisma migrate dev  # apply migrations
docker compose exec app npx prisma studio        # launch Prisma Studio
pnpm prisma:seed                  # seed test data (runs locally against port 5433)
```

For active development with hot reload, run `pnpm dev` locally — it connects to the Docker PostgreSQL and Mailpit services.

### Stripe Connect

Uses Stripe Connect Express for organiser payouts. Organisers onboard via Stripe OAuth. Payments flow through `api/organiser/stripe/`. Money is stored in integer cents.

### Terraform + Amplify CI/CD

Infrastructure is managed via Terraform in `terraform/`:
- Two GitHub Actions: `terraform-plan.yml` (on PR), `terraform-apply.yml` (on push to main)
- App code deploys via AWS Amplify on branch push: `non-production` → staging, `production` → live
- No app code CI (no lint/test/build checks) — only Terraform CI exists

## shadcn/ui conventions

- Dark theme only. CSS variables in `app/globals.css` with primary green `#B3E153`.
- Components live in `components/ui/` — use `npx shadcn@latest add <component>` to add.
- Use `cn()` from `lib/utils.ts` for conditional class merging — it combines `clsx` + `tailwind-merge`.

## Next.js conventions

- Next.js 15 with Turbopack. Use `pnpm dev` to start.
- `@/*` path alias maps to project root.
- CSP headers in `next.config.ts` allow Google Maps embeds.

## Testing

```bash
pnpm test        # Vitest unit tests
pnpm test:watch  # Vitest in watch mode
pnpm test:e2e    # Playwright e2e tests (requires Docker PostgreSQL running)
```

- Unit tests in `src/__tests__/`, e2e in `e2e/`.
- Playwright uses Chromium, auto-starts `pnpm dev` if not already running.
- E2E tests assume `DEV_BYPASS=true` (auth is skipped in dev).

### E2E test conventions

- **Every new feature MUST include E2E tests.** When adding a new page, API route, or user-facing flow, add corresponding Playwright tests in `e2e/`.
- Use the existing helper functions in `e2e/helpers.ts` when possible; extend them as needed.
- API endpoint tests use `page.evaluate()` with `fetch()` for direct HTTP assertions (status codes, error messages).
- E2E tests should cover: page renders, happy path user flow, form validation/error states, and API error responses.
- Use conditional assertions (`if (await locator.isVisible())`) for tests that depend on seed data to avoid brittle failures when seed data changes.

## GitHub

The `@modelcontextprotocol/server-github` MCP tool fails for `StartlineAU/startline` (private org repo). Use `gh` CLI commands instead:
```bash
gh issue list --repo StartlineAU/startline
gh pr list --repo StartlineAU/startline
```

## MCP servers

Configured in `.mcp.json` and `opencode.json`:
- `stripe` — Stripe API access via `@stripe/mcp`
- `resend` — Email sending via `resend-mcp`
- `playwright` — Browser automation via `@playwright/mcp`
- `aws` — AWS API access via `awslabs.aws-api-mcp-server` (uses `mcp-server` IAM profile, account `829182232071`, region `ap-southeast-2`)
- `cloudflare` — Cloudflare API access via `@cloudflare/mcp-server-cloudflare` (account `cae4a54688a0a4c53bda4bd62eb37c35`)

## Agent Skills

Custom skills live in `.agents/skills/`. Each skill is a markdown prompt that Claude loads when invoked.

| Skill | Invoke | Description |
|---|---|---|
| `caveman` | `/caveman` or "caveman mode" | Ultra-compressed responses — drops filler, articles, and pleasantries while keeping full technical accuracy. Reduces token usage ~75%. Off with "stop caveman" or "normal mode". |
| `grill-me` | `/grill-me` or "grill me" | Relentless interviewer — stress-tests a plan or design by walking down every branch of the decision tree, one question at a time, with a recommended answer per question. |
| `tdd` | `/tdd` or "use TDD" | Red-green-refactor loop. Enforces vertical slicing (one test → one impl at a time), public-interface-only testing, and a planning checklist before any code is written. Supplementary docs in `.agents/skills/tdd/`. |

## Idempotency

- Prisma client is a singleton (`lib/prisma.ts`) — never create multiple instances.
- Stripe payment intents use `stripePaymentIntentId` as unique constraint on `Registration`.
- Resend email sends should use idempotency keys to prevent duplicate delivery.
