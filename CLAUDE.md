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
  ai/                    # AI: multi-provider completion (OpenAI, Anthropic, Google), usage tracking, cost estimation
  api-keys/              # API Keys: generate, validate, revoke, list — Bearer token auth
  auth/                  # Auth: register, login, sessions, OAuth, magic links
  billing/               # Billing: Stripe checkout, webhooks, plans, limits
  email/                 # Email: sending via Resend, HTML templates
  db/                    # Database: Drizzle client, schema, types
    schema/              # Table definitions (users, sessions, subscriptions, api_keys, ai_usage, etc.)
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

app/                     # Next.js 15 App Router — the "adapter" layer
  api/auth/              # Auth API routes (register, login, logout, OAuth, etc.)
  api/billing/           # Billing API routes (checkout, portal, webhook, subscription)
  api/teams/             # Teams API routes (CRUD, members, invitations)
  api/notifications/     # Notifications API (CRUD, preferences, SSE stream)
  api/uploads/           # Upload API routes (upload, get, delete)
  api/jobs/              # Jobs API routes (status, management)
  api/admin/             # Admin API routes (users, subscriptions, metrics)
  api/ai/               # AI API routes (completion, usage) — core feature
  api/api-keys/          # API Key management routes (create, list, revoke)
  api/data/             # Data API routes (pipelines, datasets) — premium block
  api/marketplace/       # Marketplace API routes (listings, orders, reviews)
  api/health/            # Health check endpoint
  (auth)/                # Auth pages (login, signup, reset-password, verify-email)
  (dashboard)/           # Protected pages (home, billing, teams, notifications, ai, api-keys)
  (admin)/               # Admin pages (overview, users, subscriptions)
  (marketing)/           # Public pages (pricing)
  layout.tsx             # Root layout
  page.tsx               # Landing page
  globals.css            # Tailwind v4 theme tokens

components/              # React components
  ui/                    # Base: Button, Input, Card, Modal, Table, CopyButton, Toast, Dropdown
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

### AI Completion Pattern

```typescript
import { complete } from '@unblocks/core/ai'
const response = await complete({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  userId: user.id,
})
```

### API Key Auth Pattern

```typescript
// API keys work via Authorization: Bearer ub_live_xxx header
// Middleware forwards the key, serverAuth.ts validates it
// No code changes needed in route handlers — requireAuth() handles both session and API key auth
import { createApiKey, listApiKeys, revokeApiKey } from '@unblocks/core/api-keys'
const { key, apiKey } = await createApiKey(userId, { name: 'Production' })
// key is returned ONCE — store it securely
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

### Block Registry Pattern (Optional Packages)

```typescript
// In API routes — graceful degradation when an optional block is not installed
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'
const data = tryRequireBlock<{ createPipeline: Function }>('data-platform')
if (!data) {
  return errorResponse('BLOCK_NOT_AVAILABLE', 'Data platform block is not installed', 404)
}
const result = await data.createPipeline(body)
```

> **Current state:** no block package is published, so every `/api/data/*` and
> `/api/marketplace/*` route returns 404, and the dashboard screens behind them
> render hardcoded mock arrays that no user can reach. Do not extend that code
> — it is scheduled for deletion.
>
> The mechanism itself is worth keeping and is the right way to make capability
> optional: an uninstalled package contributes no routes, no dependencies, and
> no bundle weight. That is strictly safer than shipping a feature disabled by a
> runtime flag, where the code, its dependencies, and its endpoints all still
> exist and you are trusting a check.

### License Feature Check Pattern

```typescript
import { hasFeature } from '@unblocks/core/runtime/licenseValidator'
if (!hasFeature('templates.premium')) {
  throw new PlanLimitError('Premium templates require a Pro license')
}
```

> The current gate is `licenseKey.startsWith('ub_pro_')` — setting
> `UNBLOCKS_LICENSE_KEY=ub_ent_x` unlocks everything. Treat it as a placeholder,
> not access control, and never gate a security-relevant behaviour on it.

## Security Invariants

Do not weaken these without understanding what they defend. Each replaced a real
defect.

### Webhooks are idempotent

`handleStripeWebhook` records `event.id` in `webhook_events` before doing any
work and returns early on a duplicate. Stripe retries on every non-2xx, so a
handler without this gate re-applies plan changes and re-fires payment hooks.
Never remove the gate, and never swallow an event you cannot apply — throw, so
the provider retries instead of treating it as delivered.

### `x-api-key` is internal, never client-supplied

`middleware.ts` strips any inbound `x-api-key` before routing, then sets it only
from a validated `Authorization: Bearer ub_live_…`. `lib/serverAuth.ts` treats
its presence as proof middleware did that validation. If you add a code path
that forwards headers, preserve the strip — public paths reach
`getCurrentUser()` too, so the stripping runs before the public-path check.

### State-changing requests must be same-origin

`middleware.ts` rejects cross-site `POST`/`PUT`/`PATCH`/`DELETE`. The rule is
scoped to *ambient* credentials: Bearer API keys are exempt (a token is not
ambient, and blocking it would break server-to-server calls), and originless
requests are blocked only when a session cookie is present. Signature-verified
endpoints are listed in `CSRF_EXEMPT_PATHS` — currently just the Stripe webhook.

`core/security/csrf.ts` still exists but is only for the OAuth `state`
parameter. It is not the app's CSRF defence; the middleware check is.

> **The check keys off the HTTP method, so a state-changing `GET` is outside
> it.** No route may rely on it to protect one.
>
> `/api/auth/magic-link/verify` was the case that mattered: a public GET that
> called `createSession` and set the session cookie. An attacker requests a
> magic link for their own account and sends the victim that URL; clicking it
> logged the victim into the **attacker's** account, and anything they did next
> — adding a card, uploading a document — landed there.
>
> It is fixed structurally rather than patched. The GET now creates nothing: it
> redirects to `/magic-link/confirm`, and the session is created by a
> same-origin `POST` from that page, which the middleware check does cover. See
> "Magic-link sign-in is confirmed" below.
>
> `/api/auth/verify-email` remains a state-changing public GET at much lower
> severity — it flips a verification flag, it does not authenticate. Anything
> new in that shape needs the same treatment, not an exemption.

### Magic-link sign-in is confirmed

`app/api/auth/magic-link/verify/route.ts` splits the flow in two:

- **GET** (what the email links to) reads nothing and creates nothing. It
  redirects to `/magic-link/confirm?token=…`.
- **POST** (what the interstitial's form submits) verifies the token and creates
  the session. Being a POST, it is covered by the same-origin gate above, which
  is what actually closes the hole — a page under an attacker's control cannot
  make a browser issue it.

`peekMagicLink()` lets the page name the destination account **without**
consuming the token; `verifyMagicLink()` marks it used, so the page must never
call it. Naming the account is the point: a planted link shows the *attacker's*
address, which is the signal a recipient needs to refuse.

Two further rules:

- An account switch (a session already exists for a different address) requires
  an explicit `switch_account` field, checked **before** `verifyMagicLink` —
  refusing afterwards would burn the token and strand the real recipient. On a
  confirmed switch the previous session is revoked server-side, not merely
  overwritten in the cookie.
- Success redirects with `?signed_in_via=magic_link` so the landing page can
  name the account it signed you into.

`providers.magicLink.requireConfirmation: false` restores one-click sign-in and
reopens the login-CSRF. The account-switch guard stays on regardless.

### Security headers come from one place

`next.config.ts` derives its header list from `core/security/headers.ts`. They
were previously maintained separately, which is how HSTS went missing from what
was actually served. Add headers to the core module, not to the Next config.

### Credentials are stored one-way

Sessions, magic links, password resets, email verifications, team invitations
and API keys all store a blind index of the token and nothing else. Validation
only ever compares a digest, so a reversible copy buys nothing and turns the
table into a credential dump.

This was not hypothetical. Every one of those tables also carried a
`*_encrypted` column written on insert and **never read** — `decrypt()` had no
call site outside tests — so the database held a recoverable copy of every live
session and outstanding invitation. Those columns are gone.

When adding a credential: write the blind index, and resist the symmetry of
"encrypt it too". The check to run before adding any `*_encrypted` column is
simply *what reads this?* — if nothing does, it is not storage, it is exposure.

`accounts.access_token_encrypted` / `refresh_token_encrypted` are the one
legitimate exception in kind: they are credentials **for another service** that
the app must be able to replay, so they cannot be one-way. They are still
unread today (no feature calls a Google API), which makes them exposure in
practice — drop them, or give them a consumer.

### `blindIndex` uses HMAC-SHA256, and that is correct

CodeQL raises `js/insufficient-password-hash` against
`core/security/blindIndex.ts`. It is a **false positive**, and the reasoning
matters because the obvious "fix" would break the application:

1. A blind index must be **deterministic** — it backs `WHERE hash = ?`. bcrypt,
   scrypt and argon2 salt randomly per call, so they cannot support equality
   lookup. Swapping one in breaks every session validation, magic link,
   invitation and API key lookup.
2. Slow KDFs defeat brute force on *guessable* input. Everything hashed here is
   256 bits of CSPRNG output or a signed JWT — not brute-forceable at any speed.
3. It is **keyed**. Without `BLIND_INDEX_KEY`, an attacker holding the database
   cannot compute candidate digests at all.

User passwords use bcrypt in `core/auth/password.ts` and never reach
`blindIndex`. **That separation is the whole argument.** If you ever route a
user-chosen secret through `blindIndex`, the alert becomes true.

`core/security/blindIndex.entropy.test.ts` enforces the premise rather than
leaving it to a comment: it asserts every token generator feeding `blindIndex`
produces 256-bit CSPRNG output, and that passwords go to bcrypt instead. **If
that suite fails, re-examine the construction — do not re-dismiss the alert.**

**Two functions, chosen by input entropy:**

| Input | Function | Why |
|---|---|---|
| Session token, API key, magic link, password reset, email verification, team invitation | `blindIndex` (HMAC-SHA256) | 256-bit CSPRNG. Iteration count buys nothing against 2^256, and these run on the per-request hot path. |
| Email address | `slowBlindIndex` (PBKDF2-SHA256, 600k) | Enumerable (~2^30 candidates), so work factor genuinely raises an attacker's cost. Only runs at signup / OAuth / magic-link request. |

`slowBlindIndex` is deterministic (salt derived from the index key, not random),
so it still backs `WHERE hash = ?`. Its output carries a `pbkdf2$` prefix so
older HMAC values remain distinguishable in the same column.

**Never route `validateSession` or `validateApiKey` through `slowBlindIndex`** —
that would add hundreds of milliseconds to every request in exchange for nothing.
The entropy suite asserts this separation directly.

## Path Aliases

| Alias | Maps to |
|-------|---------|
| `@unblocks/core/*` | `./core/*` |
| `@unblocks/blocks/*` | `./blocks/*` |
| `@/*` | `./*` (project root) |

## Environment Variables

Required: `DATABASE_URL`, `APP_URL`, `SESSION_SECRET`
Optional: `REDIS_URL`, `STRIPE_*`, `RESEND_API_KEY`, `GOOGLE_CLIENT_*`, `UNBLOCKS_LICENSE_KEY`
AI (at least one required for `/api/ai/completion`): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`

See `.env.example` for full list.

## Database

- **Tables (16):** users, sessions, subscriptions, accounts, verification_tokens, jobs, files, teams, team_members, team_invitations, notifications, notification_preferences, api_keys, ai_usage, prompt_templates, webhook_events
- **`webhook_events`** is the idempotency ledger for inbound provider webhooks. Stripe delivers at least once and retries on any non-2xx, so `handleStripeWebhook` records the event id first and returns early if it was already recorded. Any new webhook handler must go through the same gate.
- **Block tables:** ai_usage, prompt_templates, data_sources, pipelines, pipeline_runs, datasets, seller_profiles, listings, orders, reviews
- **Generate migrations:** `npm run db:generate`
- **Apply migrations:** `npm run db:migrate`
- **Browse data:** `npm run db:studio`
- **Seed data:** `npm run db:seed`

## Testing

```bash
npm run test              # Unit tests — no services required
npm run test:watch        # Watch mode
npm run test:integration  # Integration tests — needs a real Postgres
npm run test:all          # Both
```

### Unit vs integration — which to write

Integration tests run against a throwaway Postgres on port 5433:

```bash
docker compose up -d postgres_test
npm run test:integration
```

**Write an integration test (`*.integration.test.ts`) whenever behaviour depends
on the database** — ordering, constraints, conflict handling, transactions, or
"was the row actually written". Use the harness in
`blocks/testing/integration.ts` (`getTestDb`, `truncateAll`, `closeTestDb`).

**Do not mock `drizzle-orm`.** Roughly 31 existing test files do, stubbing `eq()`
into a plain object. Such a test asserts only that you called the functions you
said you would — it cannot detect a wrong column, a missing `WHERE`, an
incorrect `ORDER BY`, or a table no migration creates. Every defect fixed in the
webhook, OAuth, and jobs-queue code was invisible to that style of test. Treat
those files as legacy; prefer an integration test over extending them.

Reserve unit tests for pure functions and boundary behaviour that needs no
database — token generation, validation schemas, cost estimation, header
construction, and "did we delegate to the SDK correctly".

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

> **This violates the Golden Rule, and it is the most common task there is.**
> Both steps edit `core/`, and step 2 edits the exact file upstream touches
> whenever it adds a table — a guaranteed merge conflict. Until `core` ships as
> a versioned package with app-owned schema paths, accept the conflict and keep
> the edit to a single added export line so it is trivial to re-apply.
>
> **If step 2 is skipped, the table is never created.** Drizzle generates
> migrations only from what the barrel re-exports, so code can reference a table
> that no migration builds and fail at runtime with "relation does not exist".
> This is exactly how `ai_usage` shipped broken. After `db:generate`, confirm
> your table appears in the output.

### Adding a new hook
1. Create file in `hooks/` named after the event
2. Export default async function
3. See `hooks/README.md` for available hook names and args

### Changing the landing page
1. Edit `config/app.config.ts` — hero text, features, FAQ items
2. Edit `config/billing.config.ts` — plan names, prices, features
3. Edit `app/globals.css` — colors and theme tokens

### Adding a new auth provider
1. Add provider logic in `core/auth/` (pure TypeScript) — also a Golden Rule
   exception; see the note under "Adding a new database table"
2. Add API routes in `app/api/auth/`
3. Add UI button in `components/auth/SocialButtons.tsx`
4. Add config options in `core/auth/types.ts` schema
5. **Pass the provider's verified-email assertion into `handleOAuthCallback`.**
   It refuses to link an identity to an existing account unless
   `emailVerified` is true, and throws `OAuthLinkRequiredError` otherwise.
   Omitting it means the provider can claim any account sharing its email —
   a pre-account-takeover path. Only Google is implemented today.

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
