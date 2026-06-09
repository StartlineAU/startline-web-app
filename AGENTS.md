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

Start local DB: `docker compose up -d`
Run migrations: `npx prisma migrate dev`
Seed: `pnpm prisma:seed`

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
- `playwright` — Browser automation via `@anthropic/mcp-playwright`

## Idempotency

- Prisma client is a singleton (`lib/prisma.ts`) — never create multiple instances.
- Stripe payment intents use `stripePaymentIntentId` as unique constraint on `Registration`.
- Resend email sends should use idempotency keys to prevent duplicate delivery.
