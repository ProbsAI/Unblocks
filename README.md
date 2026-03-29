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
npm run db:migrate && npm run dev
```

**Windows (Command Prompt)**

```cmd
git clone https://github.com/ProbsAI/Unblocks.git && cd Unblocks
copy .env.example .env && docker compose up -d && npm install
npm run db:migrate && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See the **[Setup Guide](docs/SETUP.md)** for detailed configuration.

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
| **Security** | Security | CSRF protection, rate limiting, secure sessions, security headers |
| **Config** | Config & Hooks | Zod-validated config files + event hooks for customization without modifying core |
| **Extensions** | Extension System | Self-contained modules with manifests and dependency resolution |

### Premium Blocks — Coming Soon

Optional add-ons installed from a private registry. Your app works fine without them.

| Block | What it does |
|-------|-------------|
| **AI Wrapper** | OpenAI and Anthropic completion with usage tracking and cost estimation |
| **Data Platform** | Pipelines, data sources, and datasets with background job integration |
| **Marketplace** | Listings, orders, reviews, and seller profiles |

```bash
npm install @unblocks/block-ai-wrapper   # API routes gracefully 404 when not installed
```

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
