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

**Security** — CSRF protection, rate limiting, secure sessions, bcrypt, security headers

**Config & Hooks** — Zod-validated config files + event hooks for customization without modifying core

**Extensions** — Self-contained modules with manifests and dependency resolution

### Premium Blocks -- Coming Soon

Optional add-ons installed from a private registry — your app works fine without them.

| Block | What it does |
|-------|-------------|
| **AI Wrapper** | OpenAI and Anthropic completion with usage tracking and cost estimation |
| **Data Platform** | Pipelines, data sources, and datasets with background job integration |
| **Marketplace** | Listings, orders, reviews, and seller profiles |

```bash
npm install @unblocks/block-ai-wrapper   # Example — API routes gracefully 404 when not installed
```

---

## Quick Start

```bash
git clone https://github.com/ProbsAI/Unblocks.git
cd Unblocks
npm install
docker compose up -d          # Start PostgreSQL
cp .env.example .env          # Configure your environment
npm run db:generate && npm run db:migrate
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). See the [Setup Guide](docs/SETUP.md) for detailed instructions.

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
  teams/          # Team management & RBAC
  jobs/           # Background job queue & scheduler
  uploads/        # File upload storage & validation
  notifications/  # In-app notifications & SSE
  admin/          # Admin operations & metrics
  security/       # CSRF, headers, encryption
  extensions/     # Extension system

app/              # Next.js App Router — routes, pages, layouts
components/       # React components — UI, landing, auth, dashboard
lib/              # Next.js helpers — server auth, route handler utils

config/           # YOUR config — auth, billing, email, teams, etc.
hooks/            # YOUR hooks — react to events without touching core
ui/               # YOUR overrides — shadow any component
extensions/       # YOUR extensions — self-contained feature modules
```

### The Golden Rule

> **Never modify `/core/`.** Customize through `/config/`, `/hooks/`, `/ui/`, and `/extensions/`.

This keeps your app cleanly updatable as Unblocks evolves.

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
