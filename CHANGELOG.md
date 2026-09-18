# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **`privacy.encryptUserEmail` (default true)** — user email addresses are
  stored as ciphertext with a keyed blind index for lookup, so a database dump
  alone reveals no addresses. Set it to `false` for plaintext storage, which is
  simpler and keeps substring search in the admin panel.

  **BREAKING for existing installs.** Two separate things change: the schema
  (`users.email` becomes nullable, `email_hash` is added) and the data (existing
  rows are plaintext while the shipped default is encrypted). Neither happens on
  its own, and until both are done, encrypted mode cannot even insert a user —
  the old `NOT NULL` still stands.

  With the application stopped, after deploying the new code:

  ```bash
  npm run db:push                       # or: psql "$DATABASE_URL" -f scripts/sql/upgrade-email-storage.sql
  npm run db:migrate-email-storage      # must run second — it writes email_hash
  ```

  Then `GET /api/health` reports `piiStorage: unhealthy` if any of the three
  tables still holds rows written the other way.

  Or set `privacy.encryptUserEmail: false` in `config/app.config.ts` to keep
  the old behaviour, in which case only the schema step is needed.

  **It is an install-time choice, not a setting to flip.** Changing it while
  users exist strands every row — a lookup in one mode cannot match a row
  written in the other — which is what the migration exists to move between.
  `/api/health` detects the mismatched state and reports
  `piiStorage: unhealthy`. That is a report, not a gate: nothing calls the check
  at boot, so an install in this state still starts and fails every sign-in
  until someone looks. Call `assertPiiStorageMatchesData()` from your own
  startup path if you want it to be fatal.

### Added
- `npm run db:migrate-email-storage` — moves stored addresses between the two
  storage modes, in either direction, across `users`, `verification_tokens` and
  `team_invitations`. Idempotent, so an interrupted run can simply be repeated.
  Run it with the application stopped.

  Covers every table that holds an address — `users`, `verification_tokens`
  and `team_invitations` — under the one setting.

### Removed
- **Four `*_encrypted` columns that duplicated an adjacent plaintext column:**
  `users.name_encrypted`, `files.filename_encrypted`,
  `files.original_name_encrypted` and `files.storage_key_encrypted`. Each was
  written on insert beside the column it encrypts and read by nothing, so the
  ciphertext protected an attacker from having to look one column to the left.
  Drop the columns when upgrading.

  `accounts.access_token_encrypted` / `refresh_token_encrypted` are kept: their
  plaintext twins are explicitly written `null`, so those genuinely protect a
  third-party credential.
- **`users.email_hash` and the `slowBlindIndex` derivation.** Nothing ever
  queried that column: it was written at signup, OAuth and magic-link request
  and read by no code path. Populating it cost ~260ms of synchronous PBKDF2 on
  three public endpoints — a denial-of-service vector and an account-existence
  timing oracle — in exchange for nothing. Drop the column when upgrading.

### Changed
- **BREAKING (auth):** `security.requireEmailVerification` (default true) is now
  enforced in `verifyCredentials`. It was declared and enforced nowhere, so
  existing unverified accounts could sign in with a password and can no longer
  do so. Set it to `false` to keep the old behaviour, but read the takeover
  note in `CLAUDE.md` first.
- API keys presented as `Authorization: Bearer` now work on public API routes.
  Middleware returned early for those paths before forwarding the key, so
  `/api/auth/session` rejected every valid key with a 401.
- **BREAKING (credentials):** `blindIndex` now derives with PBKDF2-SHA256
  instead of HMAC-SHA256. Every stored blind index changes, so upgrading
  invalidates all existing sessions, outstanding magic links, password resets,
  email verifications and team invitations — users sign in again and unused
  links must be re-sent. **API keys must be reissued**: the key is returned once
  and deliberately unrecoverable, so old rows cannot be re-derived. Revoke and
  re-create any key before upgrading a running install.

  The work factor (1000, RFC 2898's floor) is not a security control — the
  values hashed are 256-bit CSPRNG output, where iteration count buys nothing.
  It costs ~0.45ms of blocking CPU per authenticated request and per API call,
  against ~0.0045ms for the HMAC it replaced. Measure with
  `npm run bench:blind-index`; see the blind index section in `CLAUDE.md`
  before changing it.

### Added
- `npm run bench:blind-index` — measures the blind index derivations, so their
  cost is checked rather than asserted.

## [0.2.0-alpha] - 2026-03-28

### Added
- Extensions system with manifests and dependency resolution
- Background job queue with scheduler and cron support
- File uploads with local and S3 storage
- In-app notifications with SSE real-time streaming
- Admin panel with user management and system metrics
- Team management with RBAC (owner/admin/member)
- Config-driven landing page (hero, features, pricing, FAQ)
- AI agent instructions (CLAUDE.md) for AI-assisted development
- GitHub Actions CI pipeline with lint, typecheck, tests, and build
- Issue templates and PR template for contributor onboarding
- Code of Conduct

### Changed
- Migrated to Tailwind CSS v4
- Upgraded to Next.js 15 App Router

## [0.1.0-alpha] - Initial Release

### Added
- Authentication (email/password, Google OAuth, magic links)
- Billing (Stripe checkout, subscriptions, customer portal)
- Transactional emails via Resend
- Dashboard with sidebar navigation
- Security (CSRF, rate limiting, secure sessions)
- Zod-validated configuration system
- Event hooks for customization
