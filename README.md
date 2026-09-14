# Unblocks

**The AI-native open-source foundation for building web applications.**

Unblocks gives you auth, billing, email, teams, notifications, an admin panel, background jobs, file uploads, a landing page, and a dashboard out of the box — so you can focus on what makes your app unique.

---

## Why Unblocks?

Every SaaS app needs the same 80% of infrastructure before you can write the code that matters. Unblocks provides that foundation as a single, cohesive codebase — not a collection of scattered libraries you have to glue together.

- **Ship faster** — Skip weeks of boilerplate. Auth, billing, teams, and more are already wired up.
- **Stay in control** — Customize everything through config files and hooks. Never fork the core.
- **Built for AI-assisted development** — First-class support for AI coding agents with structured instructions and conventions.

---

## Features

**Authentication** — Email/password, Google OAuth, magic links, email verification, password reset

**Billing** — Stripe checkout, subscriptions, plan limits, customer portal, webhooks

**Teams** — Create teams, invite members, role-based access control (owner/admin/member)

**Email** — Transactional emails via Resend with HTML templates

**Background Jobs** — Queue, worker, scheduler with cron expression support

**File Uploads** — Local and S3 storage with validation and sanitization

**Notifications** — In-app notifications with SSE real-time streaming and preferences

**Admin Panel** — User management, subscription oversight, system metrics

**Landing Page** — Config-driven hero, features, pricing, FAQ sections

**Dashboard** — Protected layout with sidebar navigation and billing management

**AI** — Multi-provider completion (OpenAI, Anthropic, Google) with usage tracking and cost estimation

**API Keys** — Issue, scope, and revoke `ub_live_` keys; Bearer-token auth alongside session cookies

**Security** — Same-origin CSRF enforcement, rate limiting, secure sessions, bcrypt, HSTS + CSP, AES-256-GCM encryption helpers

**Config & Hooks** — Zod-validated config files + event hooks for customization without modifying core

**Extensions** — Extension manifest and loader (`core/extensions/`). The top-level `extensions/` directory is a placeholder; no extension ships yet.

---

## Quick Start

```bash
git clone https://github.com/ProbsAI/Unblocks.git
cd Unblocks
npm install
docker compose up -d postgres # Start PostgreSQL
cp .env.example .env          # Configure your environment
npm run db:generate && npm run db:migrate
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). See the [Setup Guide](docs/SETUP.md) for detailed instructions.

`db:generate` produces 16 tables. If you see fewer, your `core/db/schema/index.ts`
is missing exports — Drizzle only generates what that file re-exports, so a table
referenced by code but absent from the barrel is silently never created.

> **Docker is required** — PostgreSQL is not optional. On Windows, install
> [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)
> first, or point `DATABASE_URL` at a Postgres you run yourself.

### Running tests

```bash
npm run test              # Unit tests — no services required
docker compose up -d postgres_test
npm run test:integration  # Integration tests — real Postgres on port 5433
npm run test:all          # Both
```

Integration tests run against a throwaway database on a separate port, so they
can never truncate your development data. They exist because mocking the query
builder cannot catch a wrong column, a missing `WHERE`, a bad `ORDER BY`, or a
table that no migration creates — see `blocks/testing/integration.ts`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | JWT sessions, bcrypt, jose |
| Billing | Stripe |
| Email | Resend |
| Styling | Tailwind CSS v4 |
| Validation | Zod |
| Cache | Redis (optional) |
| Testing | Vitest |

---

## Project Structure

```
core/             # Pure TypeScript business logic (do not modify)
  auth/           # Authentication & sessions
  billing/        # Stripe integration & plans
  email/          # Email sending & templates
  db/             # Drizzle ORM, schemas, client
  ai/             # Multi-provider completion, usage & cost tracking
  api-keys/       # API key issue / validate / revoke / list
  teams/          # Team management & RBAC
  jobs/           # Background job queue & scheduler
  uploads/        # File upload storage & validation
  notifications/  # In-app notifications & SSE
  admin/          # Admin operations & metrics
  security/       # Encryption, blind index, headers, CSP, tokens
  extensions/     # Extension manifest & loader

app/              # Next.js App Router — routes, pages, layouts
components/       # React components — UI, landing, auth, dashboard
lib/              # Next.js helpers — server auth, route handler utils
blocks/testing/   # Test factories, fixtures, and the integration DB harness

config/           # YOUR config — auth, billing, email, teams, etc.
hooks/            # YOUR hooks — react to events without touching core
ui/               # YOUR overrides — shadow any component
extensions/       # YOUR extensions — self-contained feature modules
```

### The Golden Rule

> **Never modify `/core/`.** Customize through `/config/`, `/hooks/`, `/ui/`, and `/extensions/`.

This keeps your app cleanly updatable as Unblocks evolves.

**Known limitation, stated plainly:** the rule does not hold yet for database
schema. Adding a table currently means creating a file in `core/db/schema/` and
re-exporting it from `core/db/schema/index.ts` — the same file upstream edits
whenever *it* adds a table, so the first thing most apps do is also the first
thing that conflicts on update. `core/` is also vendored into your repo rather
than installed, so "updating" means merging rather than replacing. Making the
rule true requires publishing `core` as a versioned package and letting apps own
their own schema paths; `drizzle.config.ts` already accepts an array of schema
paths, so the second half is close. Until then, treat updatability as the
intended design rather than a delivered guarantee.

---

## Customization

| What you want to change | Where to change it |
|--------------------------|-------------------|
| App name, landing page content, SEO | `config/app.config.ts` |
| Auth providers & password policies | `config/auth.config.ts` |
| Plans, pricing, trial settings | `config/billing.config.ts` |
| Email provider & from addresses | `config/email.config.ts` |
| Background job settings | `config/jobs.config.ts` |
| Upload storage & file limits | `config/uploads.config.ts` |
| Team roles & member limits | `config/teams.config.ts` |
| Notification channels & retention | `config/notifications.config.ts` |
| Colors & theme tokens | `app/globals.css` |
| React to events (user created, payment, etc.) | `hooks/*.ts` |

---

## Documentation

- **[Setup Guide](docs/SETUP.md)** — Zero to running in 5 minutes
- **[Architecture](docs/ARCHITECTURE.md)** — System design, request lifecycle, security model
- **[Contributing](CONTRIBUTING.md)** — Development workflow, code conventions, PR guidelines
- **[Security](SECURITY.md)** — Vulnerability reporting and responsible disclosure

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

Found a security issue? Please report it privately — see [SECURITY.md](SECURITY.md).

---

## License

[MIT](LICENSE) — see [PATENTS.md](PATENTS.md) for patent notice.
