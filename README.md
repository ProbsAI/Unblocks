<p align="center">
  <h1 align="center">Unblocks</h1>
  <p align="center"><strong>The AI-native open-source foundation for building web applications.</strong></p>
</p>

<p align="center">
  <a href="https://github.com/ProbsAI/Unblocks/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/ProbsAI/Unblocks/ci.yml?branch=main&label=CI&logo=github" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ProbsAI/Unblocks?color=blue" alt="MIT License" /></a>
  <a href="https://github.com/ProbsAI/Unblocks/releases"><img src="https://img.shields.io/badge/version-0.2.0--alpha-blue" alt="Version" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15" /></a>
  <a href="https://github.com/ProbsAI/Unblocks/stargazers"><img src="https://img.shields.io/github/stars/ProbsAI/Unblocks?style=social" alt="GitHub Stars" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="docs/SETUP.md">Docs</a> &bull;
  <a href="CONTRIBUTING.md">Contributing</a> &bull;
  <!-- <a href="https://discord.gg/PLACEHOLDER">Discord</a> &bull; -->
  <a href="#community">Community</a>
</p>

---

<!-- TODO: Record a demo GIF with `vhs demo.tape` and replace this section -->
<!-- See demo.tape in the repo root for recording instructions -->

> **3 commands to a running SaaS app** with auth, billing, teams, notifications, admin panel, background jobs, file uploads, and a landing page — so you can focus on what makes your app unique.

---

## Quick Start

**Linux / macOS**

```bash
git clone https://github.com/ProbsAI/Unblocks.git && cd Unblocks
cp .env.example .env && docker compose up -d && npm install
npm run db:generate && npm run db:migrate && npm run dev
```

**Windows (Command Prompt)**

```cmd
git clone https://github.com/ProbsAI/Unblocks.git && cd Unblocks
copy .env.example .env && docker compose up -d && npm install
npm run db:generate && npm run db:migrate && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See the **[Setup Guide](docs/SETUP.md)** for detailed configuration.

> **Docker is required** — PostgreSQL is not optional. On Windows, install
> [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)
> first, or point `DATABASE_URL` at a Postgres you run yourself.
>
> `db:generate` produces **16 tables**. If you see fewer, `core/db/schema/index.ts`
> is missing exports — Drizzle generates only what that barrel re-exports, so a
> table referenced by code but absent from it is silently never created.

---

## Why Unblocks?

Every SaaS app needs the same 80% of infrastructure before you can write the code that matters. Unblocks provides that foundation as a single, cohesive codebase — not a collection of scattered libraries you have to glue together.

| | Unblocks | Typical boilerplate | Build from scratch |
|---|---|---|---|
| **Time to MVP** | Hours | Days | Weeks |
| **Auth + Billing + Teams** | Included | Partial | DIY |
| **AI-agent ready** ([CLAUDE.md](CLAUDE.md)) | Yes | No | No |
| **Config-driven customization** | Yes | Fork required | N/A |
| **License** | MIT | Varies | N/A |

- **Ship faster** — Skip weeks of boilerplate. Auth, billing, teams, and more are already wired up.
- **Stay in control** — Customize everything through config files and hooks. Never fork the core.
- **Built for AI-assisted development** — First-class support for AI coding agents with structured instructions and conventions.

---

## Features

| | Feature | What you get |
|---|---|---|
| **Auth** | Authentication | Email/password, Google OAuth, magic links, email verification, password reset |
| **Billing** | Stripe Integration | Checkout, subscriptions, plan limits, customer portal, webhooks |
| **Teams** | Team Management | Create teams, invite members, RBAC (owner / admin / member) |
| **Email** | Transactional Email | Resend integration with HTML templates |
| **Jobs** | Background Jobs | Queue, worker, scheduler with cron expression support |
| **Uploads** | File Uploads | Local and S3 storage with validation and sanitization |
| **Notify** | Notifications | In-app with SSE real-time streaming and user preferences |
| **Admin** | Admin Panel | User management, subscription oversight, system metrics |
| **Landing** | Landing Page | Config-driven hero, features, pricing, FAQ sections |
| **Dashboard** | Dashboard | Protected layout with sidebar navigation and billing management |
| **AI** | AI Completion | Multi-provider (OpenAI, Anthropic, Google) with usage tracking and cost estimation |
| **API Keys** | API Key Management | Issue, scope, and revoke `ub_live_` keys; Bearer auth alongside session cookies |
| **Security** | Security | Same-origin CSRF enforcement, rate limiting, secure sessions, bcrypt, HSTS + CSP, AES-256-GCM helpers |
| **Config** | Config & Hooks | Zod-validated config files + event hooks for customization without modifying core |
| **Extensions** | Extension System | Manifest and loader in `core/extensions/`. The top-level `extensions/` directory is a placeholder — no extension ships yet |

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
  teams/          # Team management & RBAC
  jobs/           # Background job queue & scheduler
  uploads/        # File upload storage & validation
  notifications/  # In-app notifications & SSE
  admin/          # Admin operations & metrics
  ai/             # Multi-provider completion, usage & cost tracking
  api-keys/       # API key issue / validate / revoke / list
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
schema. Adding a table means creating a file in `core/db/schema/` and
re-exporting it from `core/db/schema/index.ts` — the same file upstream edits
whenever *it* adds a table, so the first thing most apps do is also the first
thing that conflicts on update. `core/` is vendored into your repo rather than
installed, so "updating" currently means merging rather than replacing. Making
the rule true requires publishing `core` as a versioned package and letting apps
own their own schema paths; `drizzle.config.ts` already accepts an array of
schema paths, so the second half is close. Until then, treat updatability as the
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
- **[Code of Conduct](CODE_OF_CONDUCT.md)** — Community standards
- **[Security](SECURITY.md)** — Vulnerability reporting and responsible disclosure
- **[Changelog](CHANGELOG.md)** — Release history

---

## Community

- **[GitHub Issues](https://github.com/ProbsAI/Unblocks/issues)** — Bug reports and feature requests
- **[GitHub Discussions](https://github.com/ProbsAI/Unblocks/discussions)** — Questions and ideas
<!-- - **[Discord](https://discord.gg/PLACEHOLDER)** — Chat with the team (replace with real link) -->
- **[Contributing Guide](CONTRIBUTING.md)** — How to get involved

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

Found a security issue? Please report it privately — see [SECURITY.md](SECURITY.md).

If you find Unblocks useful, consider giving it a [star](https://github.com/ProbsAI/Unblocks). It helps others discover the project.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ProbsAI/Unblocks&type=Date)](https://star-history.com/#ProbsAI/Unblocks&Date)

---

## License

[MIT](LICENSE) — see [PATENTS.md](PATENTS.md) for patent notice.
