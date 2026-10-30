<img width="1020" height="156" alt="logo-title" src="https://github.com/user-attachments/assets/3bfd211a-4c61-48c5-aa9e-634c52b81ccf" />

## Overview

Startline helps performance-driven fitness individuals discover competitive events across Australia. Find fitness racing, CrossFit competitions, running races, and hybrid fitness events in one place.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with Turbopack
- **Language**: TypeScript
- **Database**: PostgreSQL 15 + Prisma ORM
- **Auth**: AWS Cognito with JWT (jose)
- **Payments**: Stripe Connect Express
- **Email**: Resend (transactional) + Mailpit (local dev)
- **Styling**: Tailwind CSS + shadcn/ui
- **Hosting**: AWS Amplify
- **Infrastructure**: Terraform ([`StartlineAU/startline-infra`](https://github.com/StartlineAU/startline-infra))

## Architecture

Three portals, domain-routed in production:
- **startlineau.com** — public event browsing
- **organiser.startlineau.com** — event management
- **admin.startlineau.com** — approval workflow, organiser management

## Getting Started

**Prerequisites:** Docker, pnpm, direnv, AWS CLI

### 1. Install tools
```bash
brew install direnv
# Add to ~/.zshrc: eval "$(direnv hook zsh)"
```

### 2. Configure direnv whitelist (one-time)
```bash
mkdir -p ~/.config/direnv
cat >> ~/.config/direnv/direnv.toml << 'EOF'
[whitelist]
prefix = ["/Users/$(whoami)/"]
EOF
```
This auto-allows `.envrc` files anywhere under your home directory. Each dev runs this once.

### 3. Load environment variables
```bash
cd <project-directory>
```
direnv loads env vars automatically from AWS Secrets Manager. Run `echo $RESEND_API_KEY` to verify.

### 4. Start infrastructure
```bash
docker compose up -d postgres mailpit
pnpm install
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server (Turbopack) |
| `pnpm build` | Production build (standalone output) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright e2e tests |
| `pnpm prisma:migrate` | Create + apply Prisma migrations (dev only, `migrate dev`) |
| `pnpm prisma:seed` | Seed Cognito + database |
| `pnpm typecheck` | TypeScript type check |
| `pnpm prisma:generate` | Generate Prisma client |

## Environment Variables

Secrets are stored in AWS Secrets Manager and loaded via direnv (`.envrc` is gitignored, managed locally):

- `startline/automation` — Trusted CI/Terraform credentials (Cloudflare, Neon, Amplify, DigitalOcean tokens). Read only by workflows on protected branches, never by a PR.
- `startline/staging/app` — Staging env vars (Cognito IDs, Stripe test keys, S3 creds, etc.)
- `startline/prod/app` — Prod env vars (live values)
- `startline/docs` — Outline documentation server only

No `.env` file in the repo. See `AGENTS.md` for local setup details.

**Rotating a key:** Update the secret in AWS Secrets Manager, trigger an Amplify rebuild, done. No code changes.

## Security

See [`SECURITY.md`](SECURITY.md) for supported versions and how to report a
vulnerability. Report privately through
[GitHub security advisories](https://github.com/StartlineAU/startline-web-app/security/advisories/new)
or `admin@startlineau.com` — never in a public issue.

## License

All Rights Reserved
