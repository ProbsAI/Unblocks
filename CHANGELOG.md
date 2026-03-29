# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
