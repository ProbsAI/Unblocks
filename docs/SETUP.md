# Setup Guide

Get Unblocks running locally in under 5 minutes.

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL and Redis)
- A Stripe account (test mode) — optional for billing
- A Resend account — optional for emails

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/ProbsAI/Unblocks.git
cd Unblocks
npm install
```

### 2. Start databases

```bash
docker compose up -d
```

This starts PostgreSQL 16 on port 5432 and Redis 7 on port 6379.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

| Variable | Required | Where to get it |
|----------|----------|----------------|
| `DATABASE_URL` | Yes | Already set for Docker |
| `REDIS_URL` | No | Already set for Docker |
| `APP_URL` | Yes | `http://localhost:3000` |
| `SESSION_SECRET` | Yes | Run `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | For billing | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → Secret key |
| `STRIPE_PUBLISHABLE_KEY` | For billing | Stripe Dashboard → Publishable key |
| `STRIPE_WEBHOOK_SECRET` | For billing | See step 5 |
| `RESEND_API_KEY` | For email | [Resend Dashboard](https://resend.com) |
| `GOOGLE_CLIENT_ID` | For OAuth | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | For OAuth | Google Cloud Console |

### 4. Set up the database

```bash
npm run db:generate
npm run db:migrate
```

### 5. Set up Stripe webhooks (optional)

Install the Stripe CLI:

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Or download from https://stripe.com/docs/stripe-cli
```

Forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Copy the webhook signing secret (`whsec_...`) into your `.env` file.

### 6. Configure Stripe plans (optional)

Create products and prices in your Stripe dashboard, then update the price IDs in `config/billing.config.ts`:

```typescript
plans: [
  {
    id: 'free',
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    // ...
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 29, yearly: 290 },
    stripePriceId: {
      monthly: 'price_YOUR_MONTHLY_PRICE_ID',
      yearly: 'price_YOUR_YEARLY_PRICE_ID',
    },
    // ...
  },
]
```

### 7. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Customization

| What | Where |
|------|-------|
| App name, tagline, landing page | `config/app.config.ts` |
| Auth providers, password policy | `config/auth.config.ts` |
| Plans, pricing, trial | `config/billing.config.ts` |
| Email provider, templates | `config/email.config.ts` |
| Colors, fonts, spacing | `app/globals.css` @theme block |
| React to events | `hooks/*.ts` |

## Common Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run db:generate  # Generate migrations from schema changes
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio (DB browser)
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```
