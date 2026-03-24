# Contributing to Unblocks

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Getting Started

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in required values
4. Start the database: `docker compose up -d`
5. Run migrations: `npm run db:migrate`
6. Start the dev server: `npm run dev`

## Development Workflow

1. Create a branch from `main` for your work
2. Make your changes following the conventions below
3. Run `npm run lint` and `npm run test` before committing
4. Push your branch and open a pull request

## The Golden Rule

> **Never modify files in `/core/`** unless your PR specifically targets core functionality.

All customization goes in `/config/`, `/hooks/`, `/ui/`, `/extensions/`. See `CLAUDE.md` for the full directory map.

## Code Conventions

- **TypeScript strict mode** — no `any` types, use `unknown` and narrow
- **Max 300 lines per file** — split large files into focused modules
- **Max 3 levels of nesting** — prefer early returns
- **Zod for all validation** — request bodies, config files, env vars
- **Drizzle ORM** — no raw SQL strings
- **Pure functions in core** — no side effects except DB/API calls

## Running Tests

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
```

Place test files next to source: `module.test.ts` alongside `module.ts`. Use helpers from `blocks/testing` for factories and fixtures.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Write a clear description of what changed and why
- Include test coverage for new functionality
- Ensure `npm run lint`, `npx tsc --noEmit`, and `npm run test` all pass
- Reference any related issues (e.g., `Fixes #123`)

## Reporting Bugs

Open a [GitHub Issue](https://github.com/ProbsAI/Unblocks/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, database)

## Requesting Features

Open a [GitHub Issue](https://github.com/ProbsAI/Unblocks/issues) with the `enhancement` label. Describe the use case and proposed approach.

## Security Vulnerabilities

**Do not open a public issue.** See [SECURITY.md](./SECURITY.md) for responsible disclosure instructions.

## AI Credit Attribution

When committing bug fixes or improvements identified by an AI agent (e.g., from a PR review), prefix each item in the commit message with `[CREDIT:@ai-username]`:

```
fix: address automated review feedback

- [CREDIT:@chatgpt-codex-connector[bot]] Re-throw Next.js redirect exceptions in withErrorHandler
- [CREDIT:@copilot-pull-request-reviewer[bot]] Add missing null check in user lookup
```

## License, IP, and Patents

By submitting a contribution, you agree to the following:

- Your contribution is licensed under the [MIT License](./LICENSE), the same license that covers this repository.
- You represent that you have the right to submit the contribution under these terms.
- **You grant a patent license** covering your contribution. Specifically, you (and your employer, affiliates, or any entity on whose behalf you contribute) grant ProbsAI and all users of this project a perpetual, worldwide, non-exclusive, royalty-free, irrevocable patent license covering any patent claims necessarily infringed by your contribution or its combination with this project. See [PATENTS.md](./PATENTS.md) for full terms.
- This grant applies to past, present, and future contributions and cannot be revoked except via the defensive termination clause in PATENTS.md.
- **This grant does not apply to ProbsAI.** Contributions made by Frowse LLC d/b/a Probs and Probs AI ("ProbsAI"), its members, employees, contractors, or agents acting within the scope of their engagement with ProbsAI are not subject to the Contributor Patent Grant. ProbsAI's own patent rights are reserved in full per [PATENTS.md](./PATENTS.md).

ProbsAI has pending patent applications covering system-level multi-agent coordination methods. These patents relate to the broader orchestration platform — not to the application-layer code in this repository. See [PATENTS.md](./PATENTS.md) for details.
