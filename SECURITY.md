# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | Yes                |
| < 0.2   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in Unblocks, please report it responsibly. **Do not open a public GitHub issue.**

### How to Report

Email **security@probsai.com** with:

1. A description of the vulnerability
2. Steps to reproduce
3. Affected versions
4. Any potential impact assessment

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Status update** within 7 days with our assessment and remediation timeline
- **Fix and disclosure** coordinated with you before any public announcement

### Scope

The following are in scope:

- Authentication and session management (`core/auth/`)
- Authorization and RBAC (`core/teams/`)
- Input validation and injection (`core/api/`)
- CSRF and security headers (`core/security/`)
- File upload validation (`core/uploads/`)
- Billing and payment handling (`core/billing/`)
- Encryption and token handling (`core/security/`, `core/auth/token.ts`)

### Out of Scope

- Vulnerabilities in third-party dependencies (report to the upstream maintainer)
- Issues requiring physical access to the server
- Social engineering attacks
- Denial of service attacks against development environments

### Recognition

We credit security researchers in our release notes (with your permission). If you'd like to be credited, include your preferred name and optional link in your report.

## Security Best Practices for Deployers

- Always set a strong, unique `SESSION_SECRET` (at least 32 characters)
- Use environment variables for all secrets; never commit `.env` files
- Enable HTTPS in production
- Keep dependencies updated via `npm audit`
- Review the `config/auth.config.ts` security settings before deploying
