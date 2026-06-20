<img width="1020" height="156" alt="logo-title" src="https://github.com/user-attachments/assets/3bfd211a-4c61-48c5-aa9e-634c52b81ccf" />

## Overview

StartLine helps performance-driven fitness individuals discover competitive events across Australia. Find fitness racing, CrossFit competitions, running races, and hybrid fitness events in one place.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with Turbopack
- **Language**: TypeScript
- **Database**: PostgreSQL 15 + Prisma ORM
- **Auth**: AWS Cognito with JWT (jose)
- **Payments**: Stripe Connect Express
- **Email**: Resend (transactional) + Mailpit (local dev)
- **Styling**: Tailwind CSS + shadcn/ui
- **Hosting**: AWS Amplify
- **Infrastructure**: Terraform

## Architecture

Three portals, domain-routed in production:
- **startlineau.com** — public event browsing
- **organiser.startlineau.com** — event management
- **Admin** — approval workflow, organiser management

## Getting Started

**Prerequisites:** Docker, pnpm

```bash
# Start infrastructure (PostgreSQL + Mailpit)
docker compose up -d postgres mailpit

# Install dependencies
pnpm install

# Apply database migrations
pnpm prisma:migrate

# Seed test data (creates Cognito users + DB records)
pnpm prisma:seed

# Run development server
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
| `pnpm prisma:migrate` | Apply Prisma migrations |
| `pnpm prisma:seed` | Seed Cognito + database |

## Deployment

See [docs/Deployment.md](docs/Deployment.md) for CI/CD, branch strategy, and environments.

## License

MIT
