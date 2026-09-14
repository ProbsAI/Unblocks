# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
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
