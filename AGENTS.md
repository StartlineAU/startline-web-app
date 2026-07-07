# AGENTS.md — Startline

## Architecture

Startline is a Next.js 15 (App Router) fitness event discovery platform with three portals:

- **User site** (`(user)/`) — public event browsing at `startlineau.com`. All users sign in here first.
- **Organiser portal** (`organiser/`) — event management at `organiser.startlineau.com`. Accessed by switching from the user dropdown (no standalone sign-in).
- **Admin portal** (`admin/`) — approval workflow, organiser management

### Domain-based routing

`middleware.ts` routes requests by hostname in production:
- `organiser.startlineau.com` → organiser portal (protects `/organiser/dashboard`, `/organiser/listings`, etc.)
- `startlineau.com` → customer site (redirects `/organiser/*` and `/admin/*` to organiser subdomain)
- Dev mode (`NODE_ENV=development`) skips all domain checks — everything runs at `localhost:3000`

### Auth (Cognito)

Uses AWS Cognito with JWT verification in middleware via `jose`. Tokens are stored in Cognito-managed cookies. The only Cognito group used for authorization is `admins` — non-admin users have no special group assignment. Authorisation is handled at the database level (Prisma).

The non-production user pool (`ap-southeast-2_KBqIYXOWT`) is managed via Terraform in `terraform/modules/environment/main.tf`. Users are created/confirmed by `prisma/seed.ts` — it calls `AdminCreateUser` + `AdminSetUserPassword` for each seed user, plus `AdminAddUserToGroup` for the admin user only.

### Account model

Every platform user has a **User** record (created on first login). Users can optionally create an **Organiser** profile (1:1 relation). Organiser profiles can be verified (auto-publish events) or unverified (events need admin approval). The organiser record stores business-specific fields (org name, ABN, Stripe Connect, etc.) while the User record stores personal profile data (name, bio, username, public/private toggle).

See `lib/amplify-server.ts` for session helpers:
- `getUserSession()` — upserts User by cognitoSub, returns `{ sub, email, name }`
- `getOrganiserSession()` — looks up User → Organiser via userId, returns `{ sub, email, status, verified }`
- `getAdminSession()` — only if `admins` group, upserts Admin

All seed users share password `Password123!`.

| Email | Notes |
|---|---|
| `admin@startline.test` | Admin (added to `admins` Cognito group) |
| `organiser@startline.test` | User + Organiser (Apex Endurance Events, verified) |
| `user@startline.test` | User only |

Run `pnpm prisma:seed` to set up Cognito users + database seed data. Idempotent — safe to re-run.

> Note: Old Cognito users from previous seeds are not automatically removed. To clean them up, delete from the Cognito pool manually or reset via Terraform.

### Database

PostgreSQL 15 via Docker on port **5432**. Prisma ORM with singleton client in `lib/prisma.ts`. Prisma schema targets `rhel-openssl-3.0.x` for Lambda/RHEL compatibility.

Mailpit runs alongside PostgreSQL in Docker (SMTP on **1026**, web UI on **8026** — host ports) for local email testing.

The app itself runs in Docker via the `app` service (Next.js standalone on port 3000). Prisma Studio runs on-demand via `docker compose exec app npx prisma studio`.

```bash
docker compose up -d              # starts PostgreSQL + Mailpit + app
pnpm prisma:migrate               # apply migrations (via prisma migrate dev)
docker compose exec app npx prisma studio        # launch Prisma Studio (or `pnpm prisma:studio` if defined)
pnpm prisma:seed                  # seed test data (runs locally against port 5432)
```

For active development with hot reload, run `bash scripts/dev.sh` (auto-starts Docker, generates Prisma client, starts Next.js) or `pnpm dev` directly — both connect to the Docker PostgreSQL and Mailpit services.

> **Git worktrees:** If the repo is a worktree (check via `git worktree list`), do NOT run `docker compose up` yourself. Docker infra (PostgreSQL, Mailpit) runs on the main checkout. Worktrees connect to the main checkout's Docker services — just run `pnpm dev` directly or via `scripts/dev.sh` (which skips Docker in worktrees).

### Stripe Connect

Uses Stripe Connect Express for organiser payouts. Organisers onboard via Stripe OAuth. Payments flow through `api/organiser/stripe/`. Money is stored in integer cents. Platform fee formula (in `lib/platform-fee.ts`): 3.95% + $1.45; `feeStructure` determines whether athlete or organiser absorbs it.

### Terraform + Amplify CI/CD

Infrastructure is managed via Terraform in `terraform/`:
- Two GitHub Actions: `terraform-plan.yml` (on PR), `terraform-apply.yml` (on push to main)
- App code deploys via AWS Amplify on branch push: `non-production` → staging, `production` → live
- No app code CI (no lint/test/build checks) — only Terraform CI exists

## Design system

The authoritative design reference lives at **`design/design.md`**. Read it before touching any UI — it covers every decision that keeps the product coherent.

### When to consult `design/design.md`

- **Any UI work** — new pages, components, layouts, or reskins of existing ones.
- **Copy / microcopy** — voice, casing rules, number formatting, Australian locale.
- **Color choices** — which token to use and when; the one-accent rule.
- **Typography** — which family, weight, size, tracking, and casing for the context.
- **Component design** — button variants, badges, cards, inputs, modals, nav.
- **Theming a shadcn default** — use the light→dark conversion table in §13 rather than inventing values.
- **Picking a design register** — Product (clean, default) vs Instrument/HUD (dashboards, launch moments). See §12.

### Non-negotiables from the design doc

- **Dark only.** `color-scheme: dark` everywhere. No light surfaces, ever.
- **One accent.** Signal green `#B3E153` (`--color-primary`) is the only brand hue. Blue/amber/red are status semantics only.
- **Chakra Petch for structure, Inter for prose.** Structural chrome is uppercase + wide tracking; body copy is sentence case Inter.
- **No emoji. Line icons (Lucide) only.**
- **Text on `#B3E153` is always `#141414` (dark ink)** — never white.
- **The "machined" shadow** (`box-shadow: 2px 2px 0 #B3E153`) belongs on the single primary CTA per view only.
- **Status labels:** `APPROVED` renders as **"Published"** to organisers. Use the shared status object — never inline ad-hoc status styles.

## shadcn/ui conventions

- Dark theme only. CSS variables in `app/globals.css` with primary green `#B3E153`.
- Components live in `components/ui/` — use `npx shadcn@latest add <component>` to add.
- Use `cn()` from `lib/utils.ts` for conditional class merging — it combines `clsx` + `tailwind-merge`.

## Next.js conventions

- Next.js 15 with Turbopack. Use `pnpm dev` to start.
- `@/*` path alias maps to project root.
- CSP headers in `next.config.ts` — currently only `worker-src blob: 'self'` (Google Maps embeds removed with Google Maps API dependency).

## Testing

```bash
pnpm lint         # ESLint (next lint)
pnpm test         # Vitest unit tests
pnpm test:watch   # Vitest in watch mode
pnpm test:e2e     # Playwright e2e tests (requires Docker PostgreSQL running)
```

- Unit tests in `src/__tests__/`, e2e in `e2e/`.
- Vitest has `globals: true` — `describe`/`it`/`expect` available without imports.
- Vitest config defaults `DATABASE_URL` to port **5432**, matching Docker.
- Playwright uses Chromium, auto-starts `pnpm dev -p 3000` if not already running.
- E2E tests authenticate via the non-production Cognito pool (password `Password123!`).

### E2E test conventions

- **Every new feature MUST include E2E tests.** When adding a new page, API route, or user-facing flow, add corresponding Playwright tests in `e2e/`.
- Use the existing helper functions in `e2e/helpers.ts` when possible; extend them as needed.
- API endpoint tests use `page.evaluate()` with `fetch()` for direct HTTP assertions (status codes, error messages).
- E2E tests should cover: page renders, happy path user flow, form validation/error states, and API error responses.
- Use conditional assertions (`if (await locator.isVisible())`) for tests that depend on seed data to avoid brittle failures when seed data changes.

## Playwright CLI (for AI browser automation)

Use `playwright-cli` instead of MCP for browser automation — it saves ~76% tokens by storing state on disk.

### Setup

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills    # installs skill pack for AI discovery
```

### Workflow

After each command, the CLI outputs a compact page summary and a reference to a snapshot file on disk. Read the snapshot file to get element refs for subsequent commands.

```bash
playwright-cli open [url]            # open browser, optionally navigate
playwright-cli goto <url>            # navigate to a url
playwright-cli snapshot              # capture accessibility snapshot (read the .yml file for refs)
playwright-cli click <ref>           # click element by ref from snapshot
playwright-cli type <text>           # type text into focused element
playwright-cli fill <ref> <text>     # fill text into specific element
playwright-cli select <ref> <val>    # select dropdown option
playwright-cli check/uncheck <ref>   # toggle checkbox/radio
playwright-cli screenshot            # take screenshot
playwright-cli close                 # close browser
```

Full command reference at `playwright-cli --help` or the `playwright-cli` skill in `.agents/skills/playwright-cli/SKILL.md`.

### Headed mode

CLI is headless by default. Pass `--headed` to `open` to see the browser:
```bash
playwright-cli open https://localhost:3000 --headed
```

### Sessions

Use `-s=<name>` for isolated browser instances (e.g., one per portal):
```bash
playwright-cli -s=customer open https://localhost:3000
playwright-cli -s=organiser open https://organiser.localhost:3000
playwright-cli list                  # list all sessions
playwright-cli close-all             # close all browsers
```

## GitHub

The `@modelcontextprotocol/server-github` MCP tool fails for `StartlineAU/startline` (private org repo). Use `gh` CLI commands instead:
```bash
gh issue list --repo StartlineAU/startline
gh pr list --repo StartlineAU/startline
```

### Pre-commit gate

Before staging or committing any change, ALWAYS run:
```bash
pnpm lint        # 0 errors, 0 warnings
pnpm test        # all tests pass
pnpm test:e2e    # all e2e tests pass (requires Docker PostgreSQL running)
```

Do not commit or push if any of these fail. Fix failures locally before pushing.

### PR conventions

When creating a pull request, always:
- Scan open GitHub issues and link any that the PR resolves or relates to. Use `Closes #N`, `Fixes #N`, or `Related to #N` in the PR body.
- Follow the PR template at `.github/PULL_REQUEST_TEMPLATE.md`.
- CI automatically runs lint, unit tests, and e2e on every PR (informational, does not block merge).

### Issue conventions

When creating GitHub issues, always:
- Add relevant **labels** (create new ones if they don't exist). Available labels: `bug`, `enhancement`, `documentation`, `auth`, `ci`, `infrastructure`, `ui`, `payments`, `maps`, `video`, `dashboard`, `registrations`, `question`, `help wanted`, `good first issue`
- Set the native **issue type** — `Bug`, `Feature`, or `Task` (not a label, a proper field)
- Set **Priority** and **Effort** issue fields using the GraphQL API — `gh issue create` has no native flags for these
- Assign a **milestone** if one exists for the relevant sprint/release
- Assign to a **project** if one exists
- Use the issue template at `.github/ISSUE_TEMPLATE/issue.yml` — it enforces Type, Priority, and Effort as required fields
- Cross-reference **related issues** in the body (`**Related to:** #N`) and use `--add-blocking`/`--add-blocked-by` for dependency relationships
- Use `--add-sub-issue` and `--parent` for parent-child issue hierarchies

#### Setting issue type (simple)
```bash
gh issue edit <N> --repo StartlineAU/startline --type "Bug|Feature|Task"
```

#### Setting Priority & Effort (GraphQL)

Field IDs (never change):
- Priority field: `IFSS_kgDOAnp8Qg`
- Effort field: `IFSS_kgDOAnp8RQ`

| Field | Option | Option ID |
|---|---|---|
| Priority | Urgent | `IFSSO_kgDOBFZBjQ` |
| Priority | High | `IFSSO_kgDOBFZBjg` |
| Priority | Medium | `IFSSO_kgDOBFZBjw` |
| Priority | Low | `IFSSO_kgDOBFZBkA` |
| Effort | High | `IFSSO_kgDOBFZBkQ` |
| Effort | Medium | `IFSSO_kgDOBFZBkg` |
| Effort | Low | `IFSSO_kgDOBFZBkw` |

Steps:
1. Get the issue's GraphQL node ID: `gh issue view <N> --repo StartlineAU/startline --json id --jq '.id'`
2. Set fields via batch mutation (copy-paste this, replace `<NODE_ID>`, `<PRI_OPT>`, `<EFF_OPT>`):
   ```bash
   gh api graphql -f query='
     mutation {
       p: updateIssueFieldValue(input: { issueId: "<NODE_ID>", issueField: { fieldId: "IFSS_kgDOAnp8Qg", singleSelectOptionId: "<PRI_OPT>" } }) { issue { number } }
       e: updateIssueFieldValue(input: { issueId: "<NODE_ID>", issueField: { fieldId: "IFSS_kgDOAnp8RQ", singleSelectOptionId: "<EFF_OPT>" } }) { issue { number } }
     }'
   ```
3. To verify: `gh issue view <N> --repo StartlineAU/startline --json id --jq '.id'` then query the GraphQL node manually if needed.

> **Note:** Priority/Effort are separate from the issue body template fields. Setting them in the body template does NOT set the GraphQL-level custom fields. You must use the GraphQL mutation above.

## MCP servers

Configured in `opencode.json`:
- `stripe` — Stripe API access via `@stripe/mcp`
- `resend` — Email sending via `resend-mcp`
- `aws` — AWS API access via `awslabs.aws-api-mcp-server` (uses `mcp-server` IAM profile, account `829182232071`, region `ap-southeast-2`)
- `cloudflare` — Cloudflare API access via `@cloudflare/mcp-server-cloudflare` (account `cae4a54688a0a4c53bda4bd62eb37c35`)

Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.
<available_skills>
  <skill>
    <name>caveman</name>
    <description>Ultra-compressed communication mode. Cuts token usage ~75% by dropping filler, articles, and pleasantries while keeping full technical accuracy. Use when user says "caveman mode", "talk like caveman", "use caveman", "less tokens", "be brief", or invokes /caveman.
</description>
    <location>file:///Users/Lachlan/.claude/skills/caveman/SKILL.md</location>
  </skill>
  <skill>
    <name>customize-opencode</name>
    <description>Use ONLY when the user is editing or creating opencode's own configuration: opencode.json, opencode.jsonc, files under .opencode/, or files under ~/.config/opencode/. Also use when creating or fixing opencode agents, subagents, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring opencode itself.</description>
    <location>file:///Users/Lachlan/Developer/startline/%3Cbuilt-in%3E</location>
  </skill>
  <skill>
    <name>find-skills</name>
    <description>Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.</description>
    <location>file:///Users/Lachlan/.agents/skills/find-skills/SKILL.md</location>
  </skill>
  <skill>
    <name>grill-me</name>
    <description>Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".</description>
    <location>file:///Users/Lachlan/Developer/startline/.agents/skills/grill-me/SKILL.md</location>
  </skill>
  <skill>
    <name>playwright-cli</name>
    <description>Automate browser interactions, test web pages and work with Playwright tests.</description>
    <location>file:///Users/Lachlan/Developer/startline/.claude/skills/playwright-cli/SKILL.md</location>
  </skill>
  <skill>
    <name>read-pdf</name>
    <description>Extract text from PDF files using pdftotext and tesseract OCR for scanned PDFs. Use when the user asks to read a PDF, mentions a .pdf file, or pastes PDF content that needs text extraction.</description>
    <location>file:///Users/Lachlan/.agents/skills/read-pdf/SKILL.md</location>
  </skill>
  <skill>
    <name>tdd</name>
    <description>Test-driven development with red-green-refactor loop. Use when user wants to build features or fix bugs using TDD, mentions "red-green-refactor", wants integration tests, or asks for test-first development.</description>
    <location>file:///Users/Lachlan/.claude/skills/tdd/SKILL.md</location>
  </skill>
</available_skills>

## Idempotency

- Prisma client is a singleton (`lib/prisma.ts`) — never create multiple instances.
- Stripe payment intents use `stripePaymentIntentId` as unique constraint on `Registration`.
- Resend email sends should use idempotency keys to prevent duplicate delivery.
