# CLAUDE.md — AI Agent Instructions for Unblocks

> This file instructs AI coding agents (Claude Code, Cursor, Copilot) how to work with this codebase.

## Project Overview

Unblocks is an AI-native open-source SaaS foundation. It provides auth, billing, email, teams, notifications, admin panel, background jobs, file uploads, and a landing page out of the box. Developers customize via config files and hooks — never by modifying core.

**Architecture:** Open-core. This public MIT repo is the core — it works standalone. Premium blocks (AI wrapper, data platform, marketplace) are separate npm packages installed from a private registry. This repo is used as a git submodule in the private `Unblocks-pro` monorepo.

**Phase:** V1C (vertical blocks)
**Stack:** Next.js 15 App Router, TypeScript strict, Drizzle ORM + PostgreSQL, Stripe, Resend, Tailwind v4, Zod

## The Golden Rule

> **NEVER modify files in `/core/`**. All customization goes in `/config/`, `/hooks/`, `/ui/`, `/extensions/`.

The `/core/` directory contains framework-agnostic pure TypeScript. It has zero React/Next.js imports. It is designed to be updatable without merge conflicts.

## Directory Map

```
core/                    # UNTOUCHABLE — pure TypeScript business logic
  auth/                  # Auth: register, login, sessions, OAuth, magic links
  billing/               # Billing: Stripe checkout, webhooks, plans, limits
  email/                 # Email: sending via Resend, HTML templates
  db/                    # Database: Drizzle client, schema, types
    schema/              # Table definitions (users, sessions, subscriptions, etc.)
  api/                   # Response helpers (successResponse, errorResponse), validation
  errors/                # AppError hierarchy, error-to-HTTP mapping
  runtime/               # Config loader (Zod validation), hook runner, UI resolver
  security/              # CSRF, security headers, cookie helpers
  jobs/                  # Background jobs: queue, worker, scheduler
  uploads/               # File uploads: storage, validation, local + S3
  teams/                 # Teams: create, invite, roles, RBAC
  notifications/         # Notifications: create, read, preferences, SSE stream
  admin/                 # Admin: user management, metrics, subscriptions
  extensions/            # Extension system: manifest, loader, registry
  index.ts               # Public API barrel

blocks/                  # COMMUNITY — open-source blocks (MIT)
  testing/               # Testing: helpers, factories, fixtures, mocks
  seed/                  # Sample data generation for development

proprietary/             # STAGING — premium blocks (moved to private repo for release)
  block-ai-wrapper/      # AI: OpenAI/Anthropic completion, usage tracking
  block-data-platform/   # Data: pipelines, datasources, datasets
  block-marketplace/     # Marketplace: listings, orders, reviews, sellers

app/                     # Next.js 15 App Router — the "adapter" layer
  api/auth/              # Auth API routes (register, login, logout, OAuth, etc.)
  api/billing/           # Billing API routes (checkout, portal, webhook, subscription)
  api/teams/             # Teams API routes (CRUD, members, invitations)
  api/notifications/     # Notifications API (CRUD, preferences, SSE stream)
  api/uploads/           # Upload API routes (upload, get, delete)
  api/jobs/              # Jobs API routes (status, management)
  api/admin/             # Admin API routes (users, subscriptions, metrics)
  api/ai/               # AI API routes (completion, usage)
  api/data/             # Data API routes (pipelines, datasets)
  api/marketplace/       # Marketplace API routes (listings, orders, reviews)
  api/health/            # Health check endpoint
  (auth)/                # Auth pages (login, signup, reset-password, verify-email)
  (dashboard)/           # Protected pages (home, billing, teams, notifications)
  (admin)/               # Admin pages (overview, users, subscriptions)
  (marketing)/           # Public pages (pricing)
  layout.tsx             # Root layout
  page.tsx               # Landing page
  globals.css            # Tailwind v4 theme tokens

components/              # React components
  ui/                    # Base: Button, Input, Card
  landing/               # Landing: Navbar, Hero, Features, Pricing, FAQ, Footer
  auth/                  # Auth: LoginForm, RegisterForm, SocialButtons
  dashboard/             # Dashboard: Sidebar, Header, NotificationBell
  billing/               # Billing: PricingTable, ManageSubscription
  teams/                 # Teams: TeamSelector, TeamMembers, InviteForm
  admin/                 # Admin: MetricCards, UserTable

lib/                     # Next.js-specific helpers
  serverAuth.ts          # getCurrentUser(), requireAuth() from cookies
  routeHandler.ts        # withErrorHandler() wrapper, getClientIp()

config/                  # USER-OWNED — Zod-validated configuration
  auth.config.ts         # Auth providers, session, password policy, security
  billing.config.ts      # Plans, pricing, trial, Stripe behavior
  email.config.ts        # Email provider, from addresses
  app.config.ts          # App name, landing page content, SEO, footer
  jobs.config.ts         # Job queue, worker concurrency, scheduler
  uploads.config.ts      # Storage provider, max size, allowed types
  teams.config.ts        # Max teams, max members, roles, invitations
  notifications.config.ts # Channels, categories, retention, SSE

hooks/                   # USER-OWNED — async event handlers
  onUserCreated.ts       # Fires after user registration
  onUserDeleted.ts       # Fires after user deletion
  onPaymentSucceeded.ts  # Fires after Stripe payment
  onPaymentFailed.ts     # Fires after failed payment
  onSubscriptionChanged.ts # Fires after plan change/cancel
  beforeEmailSend.ts     # Modifier hook — can alter email before sending

ui/                      # USER-OWNED — UI overrides (component shadowing)
extensions/              # USER-OWNED — Extension modules
middleware.ts            # Auth middleware + security headers
```

## Code Conventions

1. **Max 300 lines per file** — split into focused modules
2. **Max 3 levels of nesting** — early returns over nested conditionals
3. **No `any` type** — use `unknown` and narrow, or explicit types
4. **Explicit types** — no implicit return types on exported functions
5. **Zod for all validation** — request bodies, config files, env vars
6. **Drizzle ORM** — no raw SQL strings (exception: atomic queries needing `FOR UPDATE SKIP LOCKED`)
7. **Barrel exports** — each module has an `index.ts`
8. **Pure functions in core** — no side effects except DB/API calls

## Key Patterns

### API Route Pattern

```typescript
// app/api/example/route.ts
import { withErrorHandler } from '@/lib/routeHandler'
import { validateBody } from '@unblocks/core/api'
import { successResponse } from '@unblocks/core/api'
import { z } from 'zod'

const schema = z.object({ name: z.string() })

export const POST = withErrorHandler(async (request: Request) => {
  const body = await validateBody(request, schema)
  // ... business logic via core functions
  return successResponse(result)
})
```

### Route with URL Params Pattern

```typescript
// app/api/example/[id]/route.ts
export const GET = withErrorHandler(async (request, context) => {
  const { id } = await context!.params
  // ... use id
  return successResponse(result)
})
```

### Config Access Pattern

```typescript
import { loadConfig } from '@unblocks/core/runtime/configLoader'
const authConfig = loadConfig('auth')
```

### Hook Firing Pattern

```typescript
import { runHook } from '@unblocks/core/runtime/hookRunner'
await runHook('onUserCreated', { user, method: 'email' })
```

### Auth Check Pattern (Server Components)

```typescript
import { getCurrentUser } from '@/lib/serverAuth'
const user = await getCurrentUser()
if (!user) redirect('/login')
```

### Error Throwing Pattern

```typescript
import { AuthError, ValidationError } from '@unblocks/core/errors/types'
throw new AuthError('Invalid credentials')
throw new ValidationError('Invalid input', [{ field: 'email', message: 'Required' }])
```

### Background Job Pattern

```typescript
import { enqueueJob } from '@unblocks/core/jobs'
await enqueueJob('send-welcome-email', { userId: user.id }, { priority: 1 })
```

### Notifications Pattern

```typescript
import { createNotification } from '@unblocks/core/notifications'
await createNotification({
  userId, type: 'info', category: 'billing',
  title: 'Payment received', body: 'Your invoice has been paid.',
})
```

### Block Registry Pattern (Premium Blocks)

```typescript
// In API routes — graceful degradation when block not installed
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'
const ai = tryRequireBlock<{ complete: Function }>('ai-wrapper')
if (!ai) {
  return errorResponse('BLOCK_NOT_AVAILABLE', 'AI wrapper block is not installed', 404)
}
const result = await ai.complete(body)
```

### License Feature Check Pattern

```typescript
import { hasFeature } from '@unblocks/core/runtime/licenseValidator'
if (!hasFeature('uploads.s3')) {
  throw new PlanLimitError('S3 uploads require a Pro license')
}
```

## Path Aliases

| Alias | Maps to |
|-------|---------|
| `@unblocks/core/*` | `./core/*` |
| `@/*` | `./*` (project root) |

## Environment Variables

Required: `DATABASE_URL`, `APP_URL`, `SESSION_SECRET`
Optional: `REDIS_URL`, `STRIPE_*`, `RESEND_API_KEY`, `GOOGLE_CLIENT_*`, `UNBLOCKS_LICENSE_KEY`

See `.env.example` for full list.

## Database

- **Tables:** users, sessions, subscriptions, accounts, verification_tokens, jobs, files, teams, team_members, team_invitations, notifications, notification_preferences
- **Block tables:** ai_usage, prompt_templates, data_sources, pipelines, pipeline_runs, datasets, seller_profiles, listings, orders, reviews
- **Generate migrations:** `npm run db:generate`
- **Apply migrations:** `npm run db:migrate`
- **Browse data:** `npm run db:studio`
- **Seed data:** `npm run db:seed`

## Testing

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
```

The `blocks/testing` module provides helpers for writing tests:

```typescript
import { createTestUser, createTestTeam } from '@unblocks/blocks/testing'
import { setupTestDb, teardownTestDb } from '@unblocks/blocks/testing'
```

## Common Tasks for AI Agents

### Adding a new API endpoint
1. Create route file in `app/api/your-route/route.ts`
2. Use `withErrorHandler` wrapper and `validateBody` for input
3. Call core functions for business logic
4. Return via `successResponse()` or throw typed errors

### Adding a new database table
1. Create schema file in `core/db/schema/your-table.ts`
2. Export from `core/db/schema/index.ts`
3. Run `npm run db:generate` then `npm run db:migrate`

### Adding a new hook
1. Create file in `hooks/` named after the event
2. Export default async function
3. See `hooks/README.md` for available hook names and args

### Changing the landing page
1. Edit `config/app.config.ts` — hero text, features, FAQ items
2. Edit `config/billing.config.ts` — plan names, prices, features
3. Edit `app/globals.css` — colors and theme tokens

### Adding a new auth provider
1. Add provider logic in `core/auth/` (pure TypeScript)
2. Add API routes in `app/api/auth/`
3. Add UI button in `components/auth/SocialButtons.tsx`
4. Add config options in `core/auth/types.ts` schema

### Adding a new block
1. Create directory in `blocks/your-block/`
2. Add `types.ts` with config schema and domain types
3. Add `schema.ts` with Drizzle table definitions (if needed)
4. Add business logic modules
5. Add `index.ts` barrel export
6. Add API routes in `app/api/your-block/`
7. Add dashboard pages in `app/(dashboard)/your-block/`
8. Update `unblocks.manifest.json` with the new block

### Writing tests
1. Use helpers from `blocks/testing` for factories and fixtures
2. Place test files next to source: `module.test.ts` alongside `module.ts`
3. Use `vitest` — run with `npm run test`
4. See `blocks/testing/README.md` for available helpers

## AI PR Comment Sync

This repo uses a GitHub Actions workflow (`.github/workflows/sync-pr-comments.yml`) that captures AI-generated PR review comments and stores them as git notes under a secret ref (`refs/notes/<NOTES_REF_SUFFIX>`). To read other AIs' feedback on a PR, fetch notes with `git fetch origin refs/notes/<suffix>` and `git notes --ref=<suffix> show <HEAD_SHA>`.

## AI Credit Attribution

When committing bug fixes identified by another AI or agent, prefix each item in the commit message with `[CREDIT:@ai-username]` using the AI's GitHub username. Example:

```
- [CREDIT:@Copilot] Fix unread DB-level filtering in getNotifications
- [CREDIT:@chatgpt-codex-connector[bot]] Validate OAuth state parameter
```

See `CONTRIBUTING.md` for full attribution policy.
