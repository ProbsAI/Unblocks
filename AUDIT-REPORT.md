# Unblocks Audit Report — March 2026

Two-part audit: (1) Proprietary/licensing items to extract, and (2) Test coverage gaps to fill.

---

## REPORT 1: Proprietary & Licensing Audit

> **Corrected framing (v2):** Unblocks is an open-source SaaS foundation. The `config/`, `blocks/`, and `components/` directories are **user-owned by design** — plans, pricing, landing page copy, marketplace defaults, etc. are all things the developer is *supposed* to customize. These are features of the framework, not proprietary gates. The audit below focuses on (A) items that genuinely need attention and (B) hardcoded values in `core/` that should be configurable.

### 1.1 License Key System — RESOLVED

| File | What It Does |
|------|-------------|
| `core/env.ts:20` | Defines `UNBLOCKS_LICENSE_KEY` as optional env var with Zod validation |
| `core/types.ts:57-58` | `AppConfigSchema.footer` has `showUnblocksAttribution` (bool) and `unblocksLicenseKey` (string) |
| `config/app.config.ts:91-93` | Sets `showUnblocksAttribution: true`, `unblocksLicenseKey: ''` |
| `proprietary/license/validate.ts` | Prefix-based license validation (`ub_pro_*`, `ub_ent_*`) with cached entitlements |
| `proprietary/license/types.ts` | Three tiers: community (default), pro, enterprise with entitlement schema |
| `proprietary/license/validate.test.ts` | Tests for all tiers, caching, and `canRemoveAttribution()` |

**Status:** Implemented. The `proprietary/` folder contains license validation with three tiers. Keys are validated by prefix (`ub_pro_*` → Pro, `ub_ent_*` → Enterprise, else Community). Entitlements are cached after first check.

**What the license key controls:** Attribution removal (Pro+Enterprise) and white-label branding (Enterprise only). Community tier cannot remove attribution regardless of config setting.

**Remaining TODO:** Replace prefix-based validation with server-side check against `https://api.unblocks.ai/v1/license/validate` when the license server is ready.

---

### 1.2 "Powered by Unblocks" Attribution — RESOLVED

| File | What It Does |
|------|-------------|
| `components/landing/Footer.tsx:29-38` | Renders "Built with Unblocks" link when `showAttribution` is true |
| `app/page.tsx:15` | `showAttribution = footer.showUnblocksAttribution \|\| !canRemoveAttribution()` |
| `app/(marketing)/pricing/page.tsx:17-18` | Same license-gated logic for pricing page |

**Status:** Wired to license validation. Both `app/page.tsx` and the pricing page import `canRemoveAttribution()` from `@/proprietary/license`. Attribution shows unless the config says false AND the license permits removal. Without a valid Pro/Enterprise key, attribution always renders.

---

### 1.3 Hardcoded Values in `core/` — ALL RESOLVED

All previously-hardcoded values now read from config:

#### `core/admin/metrics.ts` — FIXED
Uses `getAveragePaidPlanPrice()` which computes from `getAllPlans()` in billing config. No hardcoded dollar amounts.

#### `core/billing/handleWebhook.ts` — FIXED
Falls back to `getAllPlans().find(p => p.price.monthly > 0)?.id` (first paid plan from config) instead of hardcoded `'pro'`. Retains `'pro'` as ultimate fallback only if no paid plans exist in config.

#### `core/billing/types.ts`
`PlanLimitsSchema` defaults (projects: 3, teamMembers: 1, etc.) are reasonable free-tier defaults. **No action needed.**

#### `blocks/ai-wrapper/usage.ts` — FIXED
`estimateCost()` reads `modelCosts` from `config/ai-wrapper.config` via dynamic require with graceful fallback. The `AIWrapperConfigSchema` in `blocks/ai-wrapper/types.ts` defines a `modelCosts` field with sensible defaults that users can override.

---

### 1.4 Items That Are Fine As-Is (No Action Needed)

The following were flagged in v1 of this report but are **working as designed** — they're user-owned configuration and framework features:

| Item | Location | Why It's Fine |
|------|----------|---------------|
| Plan definitions (Free/Pro/Business) | `config/billing.config.ts` | User-owned config — developers define their own plans |
| Plan limits & features | `config/billing.config.ts` | User-owned config — developers set their own limits |
| Trial config (14 days, Pro default) | `config/billing.config.ts` | User-owned config |
| Stripe keys from env vars | `config/billing.config.ts` | Uses env vars correctly |
| Landing page copy, FAQ, SEO | `config/app.config.ts` | User-owned config — developers write their own copy |
| Marketplace commission/pricing | `blocks/marketplace/types.ts` | Block config with sensible defaults — developers override |
| AI provider/model defaults | `blocks/ai-wrapper/types.ts` | Block config with sensible defaults — developers override |
| Stripe integration in core | `core/billing/*.ts` | Framework infrastructure — provides billing capability |
| Plan check/enforcement logic | `core/billing/checkPlanLimit.ts` | Framework infrastructure — enforces user-defined plans |
| Admin role checks | `core/admin/users.ts` | Framework infrastructure — standard RBAC |
| Upload limits | `config/uploads.config.ts` | User-owned config |
| Team limits | `config/teams.config.ts` | User-owned config |

---

### 1.5 Summary of Action Items

**All "must do" items resolved:**
1. ~~Create `proprietary/` folder~~ — Done (`proprietary/license/`)
2. ~~Wire attribution to license validation~~ — Done (`app/page.tsx`, pricing page)
3. ~~Fix hardcoded $29 MRR~~ — Done (`getAveragePaidPlanPrice()`)
4. ~~Fix hardcoded 'pro' fallback~~ — Done (`getAllPlans().find(...)`)
5. ~~Extract AI model costs to config~~ — Done (`modelCosts` in AI wrapper config schema)
6. ~~Add .gitignore entry for proprietary/~~ — Done (commented out for internal repo, uncomment for public template)

**Remaining:**
- Replace prefix-based license validation with server-side check when license server is ready

---

## REPORT 2: Test Coverage Audit

### 2.1 Current State

**Framework:** Vitest 2.1.0 with v8 coverage provider
**Existing test files:** 20
**Estimated overall coverage:** ~12-15%

### 2.2 What Exists (20 test files)

| Test File | Tests | Quality |
|-----------|-------|---------|
| `blocks/testing/assertions.test.ts` | 26 cases | Excellent |
| `blocks/testing/factories.test.ts` | 22 cases | Excellent |
| `core/auth/token.test.ts` | 11 cases | Good |
| `core/auth/password.test.ts` | 8 cases | Good |
| `core/auth/rateLimiter.test.ts` | 6 cases | Good |
| `core/security/cookies.test.ts` | 17 cases | Excellent |
| `core/security/csrf.test.ts` | 10 cases | Good |
| `core/security/headers.test.ts` | — | Good |
| `core/api/response.test.ts` | 9 cases | Good |
| `core/api/validate.test.ts` | — | Good |
| `core/uploads/validate.test.ts` | 16 cases | Good |
| `core/jobs/scheduler.test.ts` | 14 cases | Good |
| `core/billing/plans.test.ts` | — | Good |
| `core/billing/checkPlanLimit.test.ts` | — | Good |
| `core/admin/metrics.test.ts` | — | Good |
| `core/errors/types.test.ts` | — | Good |
| `core/errors/handler.test.ts` | — | Good |
| `core/runtime/configLoader.test.ts` | — | Good |
| `core/runtime/hookRunner.test.ts` | — | Good |
| `proprietary/license/validate.test.ts` | — | Good |

**Total existing: ~200+ test cases across 20 files**

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
| **core/billing** | 11 | 2 | ~18% | CRITICAL |
| **core/teams** | 7 | 0 | 0% | HIGH |
| **core/jobs** (queue/worker) | 6 | 1 | ~17% | HIGH |
| **core/security** | 5 | 3 | ~60% | MEDIUM |
| **middleware.ts** | 1 | 0 | 0% | HIGH |
| **core/notifications** | 6 | 0 | 0% | MEDIUM |
| **core/admin** | 4 | 1 | ~25% | MEDIUM |
| **core/email** | 5 | 0 | 0% | MEDIUM |
| **core/runtime** | 4 | 2 | ~50% | MEDIUM |
| **core/uploads** (remaining) | 5 | 1 | ~20% | MEDIUM |
| **core/api** | 2 | 2 | ~100% | LOW |
| **lib/** | 2 | 0 | 0% | MEDIUM |
| **core/errors** | 2 | 2 | ~100% | LOW |
| **core/extensions** | 4 | 0 | 0% | LOW |
| **core/db** | 3 | 0 | 0% | LOW |
| **proprietary/license** | 3 | 1 | ~33% | MEDIUM |
| **blocks/ai-wrapper** | 6 | 0 | 0% | MEDIUM |
| **blocks/data-platform** | 6 | 0 | 0% | MEDIUM |
| **blocks/marketplace** | 6 | 0 | 0% | MEDIUM |
| **blocks/seed** | ~3 | 0 | 0% | LOW |
| **app/api/** (all routes) | 42+ | 0 | 0% | CRITICAL |
| **components/** | 25+ | 0 | 0% | LOW |

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

#### core/billing (CRITICAL — 6 untested functions)
- `handleStripeWebhook()` — webhook event dispatch (checkout.completed, invoice.paid, invoice.failed, subscription.updated, subscription.deleted)
- `createCheckout()` — Stripe checkout session creation
- `customerPortal()` — customer portal session
- `getSubscription()` — subscription retrieval
- `cancelSubscription()` — subscription cancellation
- `changePlan()` — plan upgrade/downgrade
- ~~`checkPlanLimit()`~~ — now tested in `core/billing/checkPlanLimit.test.ts`
- ~~`plans.ts`~~ — now tested in `core/billing/plans.test.ts`
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

**Runtime module** (1 remaining):
- ~~`core/runtime/configLoader.test.ts`~~ — Done
- ~~`core/runtime/hookRunner.test.ts`~~ — Done
- `core/runtime/uiResolver.test.ts` — component resolution, fallbacks

**Lib** (2 files):
- `lib/serverAuth.test.ts` — getCurrentUser, requireAuth
- `lib/routeHandler.test.ts` — withErrorHandler, error mapping

**Security** (1 remaining):
- ~~`core/security/headers.test.ts`~~ — Done
- `core/security/index.test.ts` — combined security middleware

**Other core** (2 remaining):
- ~~`core/api/validate.test.ts`~~ — Done
- ~~`core/errors/handler.test.ts`~~ — Done
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

### Proprietary & Licensing (Report 1) — ALL RESOLVED

All action items from Report 1 have been completed:
1. ~~Create `proprietary/` folder~~ — Done
2. ~~Wire attribution to license validation~~ — Done
3. ~~Fix hardcoded $29 MRR~~ — Done
4. ~~Fix hardcoded 'pro' fallback~~ — Done
5. ~~Extract AI model costs to config~~ — Done
6. ~~Add .gitignore entry~~ — Done (commented, uncomment for public template)

**One remaining TODO:** Server-side license validation (currently prefix-based).

### Test Coverage (Report 2) — IN PROGRESS

Coverage improved from 10 → 20 test files (~139 → ~200+ cases). Key additions: billing/plans, billing/checkPlanLimit, admin/metrics, errors/types, errors/handler, runtime/configLoader, runtime/hookRunner, security/headers, api/validate, proprietary/license.

**Still needed:**
1. **Critical:** Auth module DB-dependent tests (createUser, session, verifyCredentials), remaining billing tests (webhook, checkout, customer), teams module, middleware (~15 files)
2. **High:** API route integration tests (~15 files)
3. **Medium:** Block tests, email, notifications, extensions (~15 files)
4. **Long-term:** E2E tests with Playwright, component tests (~20 files)
5. **Infrastructure:** Test DB setup, CI test step, coverage thresholds
