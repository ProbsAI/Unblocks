# Unblocks Audit Report — March 2026

Two-part audit: (1) Proprietary/licensing items to extract, and (2) Test coverage gaps to fill.

---

## REPORT 1: Proprietary & Licensing Audit

### 1.1 License Key System

| File | Lines | What It Does |
|------|-------|-------------|
| `core/env.ts` | 20 | Defines `UNBLOCKS_LICENSE_KEY` as optional env var with Zod validation |
| `core/types.ts` | 57-58 | `AppConfigSchema.footer` has `showUnblocksAttribution` (bool) and `unblocksLicenseKey` (string) |
| `config/app.config.ts` | 91-93 | Sets `showUnblocksAttribution: true`, `unblocksLicenseKey: ''` |
| `.env.example` | 37-39 | Documents `UNBLOCKS_LICENSE_KEY` as "controls footer attribution" |

**Status:** The license key is **defined but never validated anywhere**. No code reads `UNBLOCKS_LICENSE_KEY` from env, compares it to a server, or gates features on it. It's a placeholder — the field exists in the schema/config but has zero enforcement logic.

**What the license key currently controls:** Nothing. The `showUnblocksAttribution` boolean directly controls footer display with no license check. Anyone can set it to `false`.

**Action needed:**
- Decide: keep as a future hook or remove entirely
- If keeping, the validation logic would go in `core/` (currently untouchable) or as a runtime hook
- If removing, delete from: `core/env.ts:20`, `core/types.ts:57-58`, `config/app.config.ts:91-93`, `.env.example:37-39`

---

### 1.2 "Powered by Unblocks" Attribution

| File | Lines | What It Does |
|------|-------|-------------|
| `components/landing/Footer.tsx` | 29-38 | Renders "Built with Unblocks" link to `https://unblocks.ai` when `showAttribution` is true |
| `app/page.tsx` | 32 | Passes `footer.showUnblocksAttribution` to Footer component |
| `app/(marketing)/pricing/page.tsx` | 27 | Same pattern for pricing page |

**Action needed:** If you want this removable only for paying customers, you need actual license validation logic. Currently it's honor-system.

---

### 1.3 Proprietary Plans & Pricing (MOVE TO SEPARATE FOLDER)

These files contain **specific business decisions** (plan names, prices, limits, features, trial config) that you'll want to separate:

#### `config/billing.config.ts` (entire file — 78 lines)
Contains:
- **3 plan definitions:** Free ($0), Pro ($29/mo, $290/yr), Business ($99/mo, $990/yr)
- **Placeholder Stripe Price IDs:** `price_xxx`, `price_yyy` (not real, but the structure)
- **Plan limits:** projects (3/999/999), team members (1/10/999), storage (1/50/500 GB), API requests (100/10k/100k per day)
- **Feature flags per plan:** `basic_dashboard`, `email_support`, `api_access`, `priority_support`, `sso`, `audit_log`
- **Trial config:** 14-day trial on Pro plan, no payment method required
- **Behavior config:** allow downgrade, prorate on change, 3-day grace period, cancel at period end

#### `core/billing/types.ts` (entire file — 111 lines)
Contains:
- `PlanLimitsSchema` with default values (projects: 3, teamMembers: 1, storageGb: 1, apiRequestsPerDay: 100)
- `BillingConfigSchema` with default plan array (free tier defaults)
- Trial defaults (14 days, pro plan)
- Behavior defaults (prorate, grace period, etc.)
- **NOTE:** This is in `core/` (untouchable). The defaults here bake in business decisions.

#### `core/billing/plans.ts` (25 lines)
- `getFreePlan()` identifies free plan by `price.monthly === 0`
- Business logic tightly coupled to plan structure

#### `core/billing/checkPlanLimit.ts` (47 lines)
- Reads user's subscription plan from DB, looks up limits, returns `allowed: boolean`
- Falls back to free plan if plan not found
- **This is the actual feature gate** — used to enforce plan limits

#### `core/admin/metrics.ts` line 44
```typescript
const mrr = paidCount.count * 29 // Rough estimate using Pro plan price
```
- **Hardcoded $29** Pro plan price in MRR calculation. This is proprietary pricing leaking into core admin logic.

---

### 1.4 Stripe Integration Points

| File | What | Notes |
|------|------|-------|
| `config/billing.config.ts:6-8` | Stripe keys from env | Good — uses env vars, not hardcoded |
| `core/billing/createCheckout.ts` | Creates Stripe checkout sessions | Core business logic |
| `core/billing/customer.ts` | Creates/manages Stripe customers | Core business logic |
| `core/billing/customerPortal.ts` | Stripe customer portal sessions | Core business logic |
| `core/billing/handleWebhook.ts` | Processes Stripe webhooks | Core business logic; hardcodes `'pro'` as default plan on line 75 |
| `core/billing/changePlan.ts` | Stripe subscription item changes | Core business logic |
| `core/billing/cancelSubscription.ts` | Stripe subscription cancellation | Core business logic |
| `core/billing/getSubscription.ts` | Reads subscription from DB | Core business logic |
| `core/db/schema/subscriptions.ts` | DB schema with Stripe columns | `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId` |
| `.env.example:24-26` | Stripe env var templates | `sk_test_...`, `pk_test_...`, `whsec_...` |

**Key concern in `core/billing/handleWebhook.ts:75`:**
```typescript
const planId = stripeSubscription.items.data[0]?.price.metadata?.planId ?? 'pro'
```
Falls back to `'pro'` if no planId in Stripe metadata — this is a proprietary business decision hardcoded in core.

---

### 1.5 Landing Page / Marketing Content

| File | What to Extract |
|------|----------------|
| `config/app.config.ts:9-77` | Hero copy, feature descriptions, FAQ answers (mentions "MIT licensed", "Unblocks") |
| `config/app.config.ts:81-83` | SEO title template with "MyApp" placeholder |

The FAQ on lines 57-77 contains:
- "Unblocks is MIT licensed" — branding + licensing claim
- Product positioning text

---

### 1.6 Marketplace Block — Proprietary Business Config

| File | Lines | What |
|------|-------|------|
| `blocks/marketplace/types.ts:82` | 10% commission default | Business decision |
| `blocks/marketplace/types.ts:85-88` | Min/max price ($1 - $10M) | Business decision |
| `blocks/marketplace/types.ts:104-108` | Default categories (Digital, Services, Physical) | Business decision |
| `blocks/marketplace/types.ts:114-118` | Payout config ($50 min, weekly schedule) | Business decision |

---

### 1.7 AI Wrapper Block — Provider Config

| File | Lines | What |
|------|-------|------|
| `blocks/ai-wrapper/types.ts:94` | Default provider: OpenAI | Business decision |
| `blocks/ai-wrapper/types.ts:97` | Default model: `gpt-4o` | Business decision |
| `blocks/ai-wrapper/types.ts:103` | OpenAI base URL hardcoded | Vendor coupling |
| `blocks/ai-wrapper/types.ts:107` | Anthropic base URL hardcoded | Vendor coupling |

---

### 1.8 Summary: Files to Move to Proprietary Folder

**High priority (contains pricing/plans/business decisions):**
1. `config/billing.config.ts` — Plan definitions, prices, limits, trial config
2. `config/app.config.ts` — Landing page copy, branding, FAQ with licensing claims

**In `core/` (cannot move, but contain proprietary defaults — need extraction strategy):**
3. `core/billing/types.ts` — Default plan limits, trial defaults, behavior defaults
4. `core/billing/handleWebhook.ts:75` — Hardcoded `'pro'` fallback
5. `core/admin/metrics.ts:44` — Hardcoded `$29` MRR estimate
6. `core/types.ts:57-58` — License key + attribution schema
7. `core/env.ts:20` — License key env var

**Block-level defaults (can move):**
8. `blocks/marketplace/types.ts` — Commission rates, price ranges, categories, payout config
9. `blocks/ai-wrapper/types.ts` — Provider defaults, model defaults, API base URLs

**Suggested structure:**
```
proprietary/
  billing-plans.ts       # Plan definitions, prices, limits (extracted from config/billing.config.ts)
  landing-content.ts     # Hero, features, FAQ (extracted from config/app.config.ts)
  marketplace-defaults.ts # Commission, categories, payouts
  ai-defaults.ts         # Provider choices, model defaults
  README.md              # Explains what's here and why
```

---

## REPORT 2: Test Coverage Audit

### 2.1 Current State

**Framework:** Vitest 2.1.0 with v8 coverage provider
**Existing test files:** 10
**Estimated overall coverage:** ~5-8%

### 2.2 What Exists (10 test files)

| Test File | Tests | Quality |
|-----------|-------|---------|
| `blocks/testing/assertions.test.ts` | 26 cases | Excellent |
| `blocks/testing/factories.test.ts` | 22 cases | Excellent |
| `core/auth/token.test.ts` | 11 cases | Good |
| `core/auth/password.test.ts` | 8 cases | Good |
| `core/auth/rateLimiter.test.ts` | 6 cases | Good |
| `core/security/cookies.test.ts` | 17 cases | Excellent |
| `core/security/csrf.test.ts` | 10 cases | Good |
| `core/api/response.test.ts` | 9 cases | Good |
| `core/uploads/validate.test.ts` | 16 cases | Good |
| `core/jobs/scheduler.test.ts` | 14 cases | Good |

**Total existing: ~139 test cases across 10 files**

### 2.3 Test Infrastructure (blocks/testing/)

Well-built testing module with:
- **Factories:** `createTestUser()`, `createTestAdmin()`, `createTestTeam()`, `createTestNotification()`, `createTestJob()`, `createMany()`
- **Fixtures:** `singleUser()`, `adminUser()`, `teamWithMembers()`, `userWithNotifications()`, `jobQueue()`, `fullOrganization()`
- **Mocks:** `createEmailMock()`, `createStripeMock()`, `createHookSpy()`, `createConfigMock()`
- **Assertions:** `assertSuccessResponse()`, `assertErrorResponse()`, `assertUUID()`, `assertHasFields()`, `assertRecentDate()`, `assertSortedBy()`, `assertEmailSent()`
- **Request helpers:** `buildRequest()`, `buildContext()`, `buildAuthenticatedRequest()`

The infrastructure is solid but underutilized — most of these helpers have zero consumers outside their own tests.

### 2.4 Coverage Gap Matrix

| Module | Files | Tested | Coverage | Priority |
|--------|-------|--------|----------|----------|
| **core/auth** | 18 | 3 | ~17% | CRITICAL |
| **core/billing** | 11 | 0 | 0% | CRITICAL |
| **core/teams** | 7 | 0 | 0% | HIGH |
| **core/jobs** (queue/worker) | 6 | 1 | ~17% | HIGH |
| **core/security** (remaining) | 5 | 2 | ~40% | HIGH |
| **middleware.ts** | 1 | 0 | 0% | HIGH |
| **core/notifications** | 6 | 0 | 0% | MEDIUM |
| **core/admin** | 4 | 0 | 0% | MEDIUM |
| **core/email** | 5 | 0 | 0% | MEDIUM |
| **core/runtime** | 4 | 0 | 0% | MEDIUM |
| **core/uploads** (remaining) | 5 | 1 | ~20% | MEDIUM |
| **core/api** (remaining) | 2 | 1 | ~50% | MEDIUM |
| **lib/** | 2 | 0 | 0% | MEDIUM |
| **core/errors** | 2 | 0 | 0% | LOW |
| **core/extensions** | 4 | 0 | 0% | LOW |
| **core/db** | 3 | 0 | 0% | LOW |
| **blocks/ai-wrapper** | 6 | 0 | 0% | MEDIUM |
| **blocks/data-platform** | 6 | 0 | 0% | MEDIUM |
| **blocks/marketplace** | 6 | 0 | 0% | MEDIUM |
| **blocks/seed** | ~3 | 0 | 0% | LOW |
| **app/api/** (all routes) | 50+ | 0 | 0% | CRITICAL |
| **components/** | 40+ | 0 | 0% | LOW |

### 2.5 Critical Untested Functions

#### core/auth (CRITICAL — 8+ untested functions)
- `createUser()` — registration with duplicate detection, password hashing, hook firing
- `createSession()` — session creation with JWT + DB insert
- `validateSession()` — session validation with token verification + expiry
- `verifyCredentials()` — email/password verification with login tracking
- `emailVerification()` — verification token flow
- `magicLink()` — magic link authentication
- `oauth()` — OAuth provider integration
- `passwordReset()` — password reset flow
- `revokeSession()` — session revocation

#### core/billing (CRITICAL — 8 untested functions)
- `handleStripeWebhook()` — webhook event dispatch (checkout.completed, invoice.paid, invoice.failed, subscription.updated, subscription.deleted)
- `createCheckout()` — Stripe checkout session creation
- `customerPortal()` — customer portal session
- `getSubscription()` — subscription retrieval
- `cancelSubscription()` — subscription cancellation
- `changePlan()` — plan upgrade/downgrade
- `checkPlanLimit()` — the actual feature gate for plan limits
- `customer.ts` — customer creation/retrieval

#### core/teams (HIGH — 5 untested functions)
- `createTeam()` — team creation
- `getTeam()` — team retrieval with members
- `inviteMember()` — invitation flow
- `removeMember()` — member removal
- `updateRole()` — RBAC role updates

#### core/jobs (HIGH — 6 untested functions)
- `enqueueJob()` — job enqueueing with deduplication
- `fetchNextJobs()` — atomic job claim (`FOR UPDATE SKIP LOCKED`)
- `completeJob()` / `failJob()` — job lifecycle
- `cancelJob()` — cancellation
- `cleanupJobs()` — retention cleanup

#### app/api/ routes (CRITICAL — 0% coverage)
- 10+ auth routes (register, login, logout, verify-email, reset-password, magic-link, OAuth callback, session, CSRF)
- 5+ billing routes (checkout, portal, webhook, subscription, change-plan)
- 5+ team routes (CRUD, members, invitations)
- 5+ notification routes (CRUD, preferences, SSE)
- 3+ upload routes
- 3+ admin routes
- 3+ job routes
- AI, data, marketplace routes

#### middleware.ts (HIGH)
- JWT verification on protected routes
- Public path allow-listing
- Security header injection

#### lib/ (MEDIUM)
- `serverAuth.ts` — `getCurrentUser()`, `requireAuth()`
- `routeHandler.ts` — `withErrorHandler()`, `getClientIp()`, `getUserAgent()`

### 2.6 Missing Test Types

| Test Type | Status | What's Needed |
|-----------|--------|---------------|
| Unit tests (pure functions) | ~10% | Need 50+ more test files |
| Unit tests (DB-dependent) | 0% | Need test DB setup, mocking strategy |
| API integration tests | 0% | Need request/response testing for all routes |
| Middleware tests | 0% | Need request mocking |
| Component tests | 0% | Need React Testing Library setup |
| E2E tests | 0% | Need Playwright/Cypress setup |
| Performance tests | 0% | Need benchmarking framework |
| Security tests | 0% | Need CSRF, injection, auth bypass scenarios |

### 2.7 Recommended Test Implementation Plan

#### Phase 1 — Critical Core (estimate: ~35 test files)

**Auth module** (8 files):
- `core/auth/createUser.test.ts` — registration, duplicate detection, hook calls
- `core/auth/session.test.ts` — create, validate, revoke sessions
- `core/auth/verifyCredentials.test.ts` — login flows, wrong password, locked accounts
- `core/auth/emailVerification.test.ts` — token generation, verification, expiry
- `core/auth/passwordReset.test.ts` — request, token validation, password update
- `core/auth/magicLink.test.ts` — link generation, verification
- `core/auth/oauth.test.ts` — provider flow, account linking
- `middleware.test.ts` — protected routes, public paths, JWT verification

**Billing module** (7 files):
- `core/billing/plans.test.ts` — plan lookup, free plan detection
- `core/billing/checkPlanLimit.test.ts` — limit enforcement, fallback behavior
- `core/billing/createCheckout.test.ts` — Stripe session creation (mock Stripe)
- `core/billing/handleWebhook.test.ts` — all event types, signature verification
- `core/billing/customer.test.ts` — customer creation, retrieval
- `core/billing/changePlan.test.ts` — upgrade, downgrade, proration
- `core/billing/cancelSubscription.test.ts` — cancellation, grace period

**Teams module** (5 files):
- `core/teams/createTeam.test.ts`
- `core/teams/getTeam.test.ts`
- `core/teams/inviteMember.test.ts`
- `core/teams/removeMember.test.ts`
- `core/teams/updateRole.test.ts`

**Jobs module** (3 files):
- `core/jobs/queue.test.ts` — enqueue, fetch, complete, fail
- `core/jobs/worker.test.ts` — job processing, retry logic
- `core/jobs/cleanup.test.ts` — retention, stale job handling

**Runtime module** (3 files):
- `core/runtime/configLoader.test.ts` — loading, validation, caching
- `core/runtime/hookRunner.test.ts` — hook execution, error handling, timing
- `core/runtime/uiResolver.test.ts` — component resolution, fallbacks

**Lib** (2 files):
- `lib/serverAuth.test.ts` — getCurrentUser, requireAuth
- `lib/routeHandler.test.ts` — withErrorHandler, error mapping

**Security** (2 files):
- `core/security/headers.test.ts` — CSP headers, security headers
- `core/security/index.test.ts` — combined security middleware

**Other core** (5 files):
- `core/api/validate.test.ts` — body/query validation
- `core/errors/handler.test.ts` — error-to-HTTP mapping
- `core/email/send.test.ts` — email sending (mock Resend)
- `core/email/templates.test.ts` — template rendering
- `core/notifications/create.test.ts` — notification creation + preferences

#### Phase 2 — API Route Integration Tests (estimate: ~15 test files)

- `app/api/auth/register/route.test.ts`
- `app/api/auth/login/route.test.ts`
- `app/api/auth/logout/route.test.ts`
- `app/api/auth/verify-email/route.test.ts`
- `app/api/auth/reset-password/route.test.ts`
- `app/api/billing/checkout/route.test.ts`
- `app/api/billing/webhook/route.test.ts`
- `app/api/billing/subscription/route.test.ts`
- `app/api/teams/route.test.ts`
- `app/api/teams/[id]/members/route.test.ts`
- `app/api/notifications/route.test.ts`
- `app/api/uploads/route.test.ts`
- `app/api/admin/users/route.test.ts`
- `app/api/jobs/route.test.ts`
- `app/api/health/route.test.ts`

#### Phase 3 — Blocks (estimate: ~12 test files)

- `blocks/ai-wrapper/completion.test.ts`
- `blocks/ai-wrapper/usage.test.ts`
- `blocks/ai-wrapper/templates.test.ts`
- `blocks/data-platform/pipelines.test.ts`
- `blocks/data-platform/datasources.test.ts`
- `blocks/data-platform/datasets.test.ts`
- `blocks/marketplace/listings.test.ts`
- `blocks/marketplace/orders.test.ts`
- `blocks/marketplace/reviews.test.ts`
- `blocks/marketplace/sellers.test.ts`
- `blocks/seed/generators.test.ts`
- `blocks/seed/seed.test.ts`

#### Phase 4 — E2E & Components (estimate: ~20 test files)

- Playwright setup + config
- Auth flows E2E (register → verify → login → dashboard)
- Billing flows E2E (select plan → checkout → manage)
- Team flows E2E (create → invite → accept → collaborate)
- Component tests for critical UI (PricingTable, LoginForm, RegisterForm)

### 2.8 Test Infrastructure Gaps to Fill

1. **Database mocking strategy** — Need either a test DB with migrations or comprehensive mocking of `getDb()` / Drizzle queries
2. **Stripe mocking** — `createStripeMock()` exists in blocks/testing but is unused; need to wire it into billing tests
3. **Email mocking** — `createEmailMock()` exists but unused
4. **React Testing Library** — Not installed; needed for component tests
5. **Playwright** — Not installed; needed for E2E tests
6. **CI integration** — No test step in CI/CD config
7. **Coverage thresholds** — No minimum coverage enforced

---

## Summary of Action Items

### Proprietary Extraction (Report 1)
1. Create `proprietary/` folder for business-specific config
2. Extract plan definitions, pricing, limits from `config/billing.config.ts`
3. Extract landing page copy and FAQ from `config/app.config.ts`
4. Extract marketplace defaults from `blocks/marketplace/types.ts`
5. Extract AI provider defaults from `blocks/ai-wrapper/types.ts`
6. Fix hardcoded `$29` in `core/admin/metrics.ts:44`
7. Fix hardcoded `'pro'` fallback in `core/billing/handleWebhook.ts:75`
8. Decide on license key system: enforce, remove, or defer

### Test Coverage (Report 2)
1. **Immediate:** Write tests for auth, billing, and teams core modules (~20 files)
2. **Soon:** Write API route integration tests (~15 files)
3. **Medium-term:** Write block tests + remaining core (~15 files)
4. **Long-term:** Add E2E tests with Playwright (~20 files)
5. **Infrastructure:** Set up test DB, enforce coverage thresholds in CI
