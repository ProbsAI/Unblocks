# CLAUDE.md — AI Agent Instructions for Unblocks

> This file instructs AI coding agents (Claude Code, Cursor, Copilot) how to work with this codebase.

## Project Overview

Unblocks is an AI-native open-source SaaS foundation. It provides auth, billing, email, landing page, and dashboard out of the box. Developers customize via config files and hooks — never by modifying core.

**Phase:** V1A (soft launch)
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
  runtime/               # Config loader (Zod validation), hook runner
  security/              # CSRF, security headers, cookie helpers
  index.ts               # Public API barrel

app/                     # Next.js 15 App Router — the "adapter" layer
  api/auth/              # Auth API routes (register, login, logout, OAuth, etc.)
  api/billing/           # Billing API routes (checkout, portal, webhook, subscription)
  api/health/            # Health check endpoint
  (auth)/                # Auth pages (login, signup, reset-password, verify-email)
  (dashboard)/           # Protected pages (home, billing)
  (marketing)/           # Public pages (pricing)
  layout.tsx             # Root layout
  page.tsx               # Landing page
  globals.css            # Tailwind v4 theme tokens

components/              # React components
  ui/                    # Base: Button, Input, Card
  landing/               # Landing: Navbar, Hero, Features, Pricing, FAQ, Footer
  auth/                  # Auth: LoginForm, RegisterForm, SocialButtons
  dashboard/             # Dashboard: Sidebar, Header
  billing/               # Billing: PricingTable, ManageSubscription

lib/                     # Next.js-specific helpers
  serverAuth.ts          # getCurrentUser(), requireAuth() from cookies
  routeHandler.ts        # withErrorHandler() wrapper, getClientIp()

config/                  # USER-OWNED — Zod-validated configuration
  auth.config.ts         # Auth providers, session, password policy, security
  billing.config.ts      # Plans, pricing, trial, Stripe behavior
  email.config.ts        # Email provider, from addresses
  app.config.ts          # App name, landing page content, SEO, footer

hooks/                   # USER-OWNED — async event handlers
  onUserCreated.ts       # Fires after user registration
  onUserDeleted.ts       # Fires after user deletion
  onPaymentSucceeded.ts  # Fires after Stripe payment
  onPaymentFailed.ts     # Fires after failed payment
  onSubscriptionChanged.ts # Fires after plan change/cancel
  beforeEmailSend.ts     # Modifier hook — can alter email before sending

ui/                      # USER-OWNED — UI overrides (V1B)
extensions/              # USER-OWNED — Extension modules (V1B)
middleware.ts            # Auth middleware + security headers
```

## Code Conventions

1. **Max 300 lines per file** — split into focused modules
2. **Max 3 levels of nesting** — early returns over nested conditionals
3. **No `any` type** — use `unknown` and narrow, or explicit types
4. **Explicit types** — no implicit return types on exported functions
5. **Zod for all validation** — request bodies, config files, env vars
6. **Drizzle ORM** — no raw SQL strings
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

- **Tables:** users, sessions, subscriptions, accounts, verification_tokens
- **Generate migrations:** `npm run db:generate`
- **Apply migrations:** `npm run db:migrate`
- **Browse data:** `npm run db:studio`

## Testing

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
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

## AI PR Comment Sync

This repo uses a GitHub Actions workflow (`.github/workflows/sync-pr-comments.yml`) that captures AI-generated PR review comments and stores them as git notes under a secret ref (`refs/notes/<NOTES_REF_SUFFIX>`). To read other AIs' feedback on a PR, fetch notes with `git fetch origin refs/notes/<suffix>` and `git notes --ref=<suffix> show <HEAD_SHA>`.
