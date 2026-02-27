# Architecture

## Overview

Unblocks is a modular, AI-native SaaS foundation. The codebase is split into a **framework-agnostic core** and a **Next.js adapter layer**.

```
unblocks/
├── core/           # Pure TypeScript — NEVER import React/Next.js here
│   ├── auth/       # Authentication & sessions
│   ├── billing/    # Stripe integration & plans
│   ├── email/      # Email sending & templates
│   ├── db/         # Drizzle ORM, schemas, client
│   ├── api/        # Response helpers, validation
│   ├── errors/     # Error types & handler
│   ├── runtime/    # Config loader, hook runner
│   ├── security/   # CSRF, headers, cookies
│   └── index.ts    # Public API barrel
├── app/            # Next.js 15 App Router (adapter layer)
│   ├── api/        # Route handlers calling core functions
│   ├── (auth)/     # Auth pages (login, signup, reset, verify)
│   ├── (dashboard)/ # Protected dashboard pages
│   └── (marketing)/ # Public marketing pages
├── components/     # React components (UI, landing, auth, dashboard)
├── lib/            # Next.js helpers (serverAuth, routeHandler)
├── config/         # User-owned config files (Zod-validated)
├── hooks/          # User-owned event hooks
├── ui/             # UI override system (V1B)
├── extensions/     # Extension system (V1B)
└── middleware.ts   # Next.js middleware (auth, security)
```

## The Golden Rule

> **Never modify `/core/`** — all customization goes in `/config/`, `/hooks/`, `/ui/`, `/extensions/`.

The core is designed to be updatable without merge conflicts. User-owned files live outside core.

## Request Lifecycle

```
Browser → middleware.ts → app/api/*/route.ts → core/*
                                                 │
                                      ┌──────────┼──────────┐
                                      │          │          │
                                   core/auth  core/billing  core/email
                                      │          │          │
                                      ▼          ▼          ▼
                                   core/db   Stripe API   Resend API
                                      │
                                      ▼
                                  PostgreSQL
```

1. Request hits Next.js middleware → validates session cookie, enforces auth
2. Route handler in `app/api/` validates input with Zod, calls core function
3. Core function executes business logic, interacts with DB/APIs
4. Core function fires relevant hooks (async, non-blocking)
5. Route handler returns standardized JSON response

## Config System

Config files in `/config/` are validated with Zod at startup:

| Config File | Schema | Controls |
|-------------|--------|----------|
| `config/auth.config.ts` | `AuthConfigSchema` | Providers, session, password policy, security |
| `config/billing.config.ts` | `BillingConfigSchema` | Plans, pricing, trial, Stripe settings |
| `config/email.config.ts` | `EmailConfigSchema` | Provider, from address, queue settings |
| `config/app.config.ts` | `AppConfigSchema` | App name, landing page content, SEO, footer |

If a config file is missing or invalid, the app throws a clear error at startup with the exact field that failed validation.

## Hook System

Hooks are async event handlers in `/hooks/`. They fire after core operations complete:

```
core/auth/createUser.ts
  → inserts user into DB
  → runs runHook('onUserCreated', { user, method })
    → hooks/onUserCreated.ts executes (if it exists)
    → errors are caught, logged, never crash the app
```

Hooks can be "before" hooks (modify args and return) or "after" hooks (fire and forget).

## Session Management

- Sessions are JWT-based (HS256 signed with `SESSION_SECRET`)
- Session records stored in `sessions` table with expiry
- JWT stored in HttpOnly secure cookie (`__unblocks_session`)
- Validated on every protected request via middleware
- 7-day expiry by default (configurable in `config/auth.config.ts`)

## Billing Flow

```
User clicks "Upgrade"
  → POST /api/billing/checkout { planId, interval }
  → core/billing/createCheckout.ts → Stripe Checkout Session
  → User redirected to Stripe
  → Payment completes
  → Stripe sends webhook → POST /api/billing/webhook
  → core/billing/handleWebhook.ts → updates subscriptions table
  → Fires onPaymentSucceeded, onSubscriptionChanged hooks
```

## Database

- **ORM**: Drizzle ORM with PostgreSQL
- **Schema files**: `core/db/schema/*.ts`
- **Migrations**: Generated via `npm run db:generate`, applied via `npm run db:migrate`
- **Tables**: users, sessions, subscriptions, accounts (OAuth), verification_tokens

## Security

- CSRF protection via double-submit cookie pattern
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, CSP
- Account enumeration prevention (generic error messages)
- bcrypt password hashing (12 salt rounds)
- Rate limiting on auth endpoints (sliding window)
- HttpOnly secure session cookies
