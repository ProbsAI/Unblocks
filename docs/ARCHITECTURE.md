# Architecture

## Overview

Unblocks is a modular, AI-native SaaS foundation. The codebase is split into a **framework-agnostic core**, a **Next.js adapter layer**, and **optional vertical blocks**.

```
unblocks/
├── core/               # Pure TypeScript — NEVER import React/Next.js here
│   ├── auth/           # Authentication & sessions
│   ├── billing/        # Stripe integration & plans
│   ├── email/          # Email sending & templates
│   ├── db/             # Drizzle ORM, schemas, client
│   ├── api/            # Response helpers, validation
│   ├── errors/         # Error types & handler
│   ├── runtime/        # Config loader, hook runner, UI resolver
│   ├── security/       # CSRF, headers, cookies
│   ├── jobs/           # Background job queue, worker, scheduler
│   ├── uploads/        # File upload storage & validation
│   ├── teams/          # Team management & RBAC
│   ├── notifications/  # In-app notifications & SSE streaming
│   ├── admin/          # Admin operations & system metrics
│   ├── extensions/     # Extension manifest, loader, registry
│   └── index.ts        # Public API barrel
├── blocks/             # Optional vertical domain modules
│   ├── ai-wrapper/     # AI completion with OpenAI/Anthropic
│   ├── data-platform/  # Pipelines, data sources, datasets
│   ├── marketplace/    # Listings, orders, reviews, sellers
│   ├── testing/        # Test helpers, factories, fixtures
│   └── seed/           # Sample data generation
├── app/                # Next.js 15 App Router (adapter layer)
│   ├── api/            # Route handlers calling core functions
│   ├── (auth)/         # Auth pages (login, signup, reset, verify)
│   ├── (dashboard)/    # Protected pages (home, billing, teams, notifications)
│   ├── (admin)/        # Admin pages (overview, users, subscriptions)
│   └── (marketing)/    # Public marketing pages (pricing)
├── components/         # React components (UI, landing, auth, dashboard, teams, admin)
├── lib/                # Next.js helpers (serverAuth, routeHandler)
├── config/             # User-owned config files (Zod-validated)
├── hooks/              # User-owned event hooks
├── ui/                 # UI override system (component shadowing)
├── extensions/         # Extension modules
└── middleware.ts        # Next.js middleware (auth, security)
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
| `config/jobs.config.ts` | `JobsConfigSchema` | Queue concurrency, worker settings, schedulers |
| `config/uploads.config.ts` | `UploadsConfigSchema` | Storage provider, max size, allowed types |
| `config/teams.config.ts` | `TeamsConfigSchema` | Max teams, max members, roles, invitations |
| `config/notifications.config.ts` | `NotificationsConfigSchema` | Channels, categories, retention, SSE |

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

### Available Hooks

| Hook | Fires When | Args |
|------|-----------|------|
| `onUserCreated` | After user registration | `{ user, method }` |
| `onUserDeleted` | After user deletion | `{ user }` |
| `onAuthSuccess` | After successful login | `{ user, method }` |
| `onAuthFailure` | After failed login | `{ email, reason }` |
| `onPaymentSucceeded` | After Stripe payment | `{ user, subscription, invoice }` |
| `onPaymentFailed` | After failed payment | `{ user, subscription, error }` |
| `onSubscriptionChanged` | After plan change/cancel | `{ user, subscription, previousPlan }` |
| `onJobCompleted` | After job finishes | `{ job, result }` |
| `onJobFailed` | After job fails | `{ job, error }` |
| `onFileUploaded` | After file upload | `{ file, user }` |
| `onTeamCreated` | After team creation | `{ team, owner }` |
| `onTeamMemberAdded` | After member joins | `{ team, member, role }` |
| `onNotificationCreated` | After notification sent | `{ notification }` |
| `beforeEmailSend` | Before email dispatch | `{ to, subject, html }` (modifier) |
| `onError` | When any hook throws | `{ hookName, error }` |

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

## Background Jobs

The job system provides reliable async task processing:

```
Enqueue → core/jobs/queue.ts → jobs table (status: pending)
                                      │
Worker polls → fetchNextJobs() ──────┘
  → Atomic claim via FOR UPDATE SKIP LOCKED
  → Execute handler → completeJob() or failJob()
  → Fire onJobCompleted / onJobFailed hooks
```

The scheduler runs cron expressions and enqueues jobs on schedule.

## Teams & RBAC

Teams support three roles: **owner**, **admin**, **member**.

- Owners can transfer ownership, delete team, manage all members
- Admins can invite/remove members, update roles (except owner)
- Members can view team data and leave

Invitations use tokens with configurable expiry.

## Notifications & SSE

Notifications support real-time delivery via Server-Sent Events:

```
createNotification() → insert to DB → broadcast to SSE subscribers
                                            │
Client connects to /api/notifications/stream ┘
  → ReadableStream with cancel() cleanup
  → Ping every 30s to detect disconnects
```

Preferences control which categories and channels each user receives.

## Blocks

Blocks are optional vertical domain modules in `/blocks/`. They follow the same patterns as core but are domain-specific:

- **AI Wrapper** — Multi-provider completion (OpenAI, Anthropic) with usage tracking and cost estimation
- **Data Platform** — Pipeline management with datasources and datasets, integrated with background jobs
- **Marketplace** — Listings, orders, reviews, and seller profiles for two-sided marketplaces
- **Testing** — Shared test utilities: factories, fixtures, mocks, and DB helpers
- **Seed** — Development data generation for all core tables and block tables

## Database

- **ORM**: Drizzle ORM with PostgreSQL
- **Schema files**: `core/db/schema/*.ts` (core), `blocks/*/schema.ts` (blocks)
- **Migrations**: Generated via `npm run db:generate`, applied via `npm run db:migrate`
- **Core tables**: users, sessions, subscriptions, accounts, verification_tokens, jobs, files, teams, team_members, team_invitations, notifications, notification_preferences
- **Block tables**: ai_usage, prompt_templates, data_sources, pipelines, pipeline_runs, datasets, seller_profiles, listings, orders, reviews

## Security

- CSRF protection via double-submit cookie pattern
- OAuth state validation via short-lived HttpOnly cookies
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, CSP
- Account enumeration prevention (generic error messages)
- bcrypt password hashing (12 salt rounds)
- Rate limiting on auth endpoints (sliding window)
- HttpOnly secure session cookies
- Atomic job claiming prevents duplicate execution
- Notification deletion scoped to owning user
