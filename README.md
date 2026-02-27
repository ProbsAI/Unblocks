# Unblocks

**The AI-native open-source foundation for building web applications.**

Unblocks gives you auth, billing, email, a landing page, and a dashboard out of the box — so you can focus on what makes your app unique.

## Features

- **Auth** — Email/password, Google OAuth, magic links, email verification, password reset
- **Billing** — Stripe checkout, subscriptions, plan limits, customer portal, webhooks
- **Email** — Transactional emails via Resend with HTML templates
- **Landing Page** — Config-driven hero, features, pricing, FAQ sections
- **Dashboard** — Protected layout with sidebar, billing management
- **Config System** — Zod-validated config files with clear error messages
- **Hook System** — React to events (user created, payment succeeded, etc.) without modifying core
- **Security** — CSRF, rate limiting, secure sessions, bcrypt, security headers

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

## Project Structure

```
core/           # Pure TypeScript — framework-agnostic business logic
app/            # Next.js App Router — routes, pages, layouts
components/     # React components — UI, landing, auth, dashboard
lib/            # Next.js helpers — server auth, route handler utils
config/         # Your config — auth, billing, email, app settings
hooks/          # Your hooks — react to events without touching core
ui/             # UI overrides (V1B)
extensions/     # Extensions (V1B)
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
| Colors & theme | `app/globals.css` |
| Event reactions | `hooks/*.ts` |

## Documentation

- [Setup Guide](docs/SETUP.md) — Zero to running in 5 minutes
- [Architecture](docs/ARCHITECTURE.md) — System design, request lifecycle, security model

## Roadmap

- **V1A** (current) — Core systems: auth, billing, email, landing page, dashboard
- **V1B** — Teams, admin panel, background jobs, file uploads, notifications, UI override system, extension system
- **V1C** — Vertical blocks: Data Platform, AI Wrapper, Marketplace

## License

[MIT](LICENSE) — Built with Unblocks.
