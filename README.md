# Unblocks

**The AI-native open-source foundation for building web applications.**

Unblocks gives you auth, billing, email, teams, notifications, admin panel, background jobs, file uploads, a landing page, and a dashboard out of the box — so you can focus on what makes your app unique.

## Features

### Core (V1A)
- **Auth** — Email/password, Google OAuth, magic links, email verification, password reset
- **Billing** — Stripe checkout, subscriptions, plan limits, customer portal, webhooks
- **Email** — Transactional emails via Resend with HTML templates
- **Landing Page** — Config-driven hero, features, pricing, FAQ sections
- **Dashboard** — Protected layout with sidebar, billing management
- **Config System** — Zod-validated config files with clear error messages
- **Hook System** — React to events (user created, payment succeeded, etc.) without modifying core
- **Security** — CSRF, rate limiting, secure sessions, bcrypt, security headers

### Platform (V1B)
- **Teams** — Create teams, invite members, role-based access control (owner/admin/member)
- **Background Jobs** — Queue, worker, scheduler with cron expression support
- **File Uploads** — Local and S3 storage with validation and sanitization
- **Notifications** — In-app notifications with SSE real-time streaming and preferences
- **Admin Panel** — User management, subscription oversight, system metrics
- **UI Override System** — Shadow components in `ui/` to customize without touching core
- **Extension System** — Self-contained modules with manifests and dependency resolution

### Community Blocks (V1C)
- **Testing** — Test helpers, factories, fixtures, and mocks for writing comprehensive tests
- **Seed** — Sample data generation for local development

### Premium Blocks (Pro License)
- **AI Wrapper** — OpenAI and Anthropic completion with usage tracking and cost estimation
- **Data Platform** — Pipelines, data sources, and datasets with background job integration
- **Marketplace** — Listings, orders, reviews, and seller profiles

> Premium blocks are installed via `npm install @unblocks/block-ai-wrapper` from the private registry. API routes gracefully return 404 when a block isn't installed — no build errors.

## Quick Start

```bash
git clone https://github.com/ProbsAI/Unblocks.git
cd Unblocks
npm install
docker compose up -d
cp .env.example .env
# Edit .env with your keys (see docs/SETUP.md)
npm run db:generate && npm run db:migrate
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Stack

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

## Project Structure

```
core/           # Pure TypeScript — framework-agnostic business logic
  auth/         # Authentication & sessions
  billing/      # Stripe integration & plans
  email/        # Email sending & templates
  db/           # Drizzle ORM, schemas, client
  jobs/         # Background job queue, worker, scheduler
  uploads/      # File upload storage & validation
  teams/        # Team management & RBAC
  notifications/# In-app notifications & SSE
  admin/        # Admin operations & metrics
  extensions/   # Extension system
blocks/         # Optional vertical domain modules
app/            # Next.js App Router — routes, pages, layouts
components/     # React components — UI, landing, auth, dashboard, teams, admin
lib/            # Next.js helpers — server auth, route handler utils
config/         # Your config — auth, billing, email, app, jobs, uploads, teams, notifications
hooks/          # Your hooks — react to events without touching core
ui/             # UI overrides — shadow components to customize
extensions/     # Extensions — self-contained feature modules
```

## The Golden Rule

> **Never modify `/core/`** — customize through `/config/`, `/hooks/`, `/ui/`, and `/extensions/`.

This keeps your app updatable as Unblocks evolves.

## Customize

| What | Where |
|------|-------|
| App name & landing page | `config/app.config.ts` |
| Auth providers & policies | `config/auth.config.ts` |
| Plans & pricing | `config/billing.config.ts` |
| Email provider & templates | `config/email.config.ts` |
| Background jobs | `config/jobs.config.ts` |
| File uploads | `config/uploads.config.ts` |
| Teams & roles | `config/teams.config.ts` |
| Notifications | `config/notifications.config.ts` |
| Colors & theme | `app/globals.css` |
| Event reactions | `hooks/*.ts` |

## Documentation

- [Setup Guide](docs/SETUP.md) — Zero to running in 5 minutes
- [Architecture](docs/ARCHITECTURE.md) — System design, request lifecycle, security model
- [Contributing](CONTRIBUTING.md) — How to contribute, AI credit attribution

## Roadmap

- **V1A** — Core systems: auth, billing, email, landing page, dashboard
- **V1B** — Teams, admin panel, background jobs, file uploads, notifications, UI override system, extension system
- **V1C** (current) — Vertical blocks: AI Wrapper, Data Platform, Marketplace, Testing, Seed

## License

[MIT](LICENSE) — Built with Unblocks.
