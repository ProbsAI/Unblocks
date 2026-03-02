# Plan: Decouple Premium Features — Public Repo as Monorepo Submodule

## Architecture Overview

This repo (Unblocks) is the **public MIT-licensed core**. It becomes a git submodule inside a private `Unblocks-pro` monorepo:

```
Unblocks-pro/              (private repo)
├── packages/
│   ├── core/              ← git submodule → github.com/ProbsAI/Unblocks (THIS repo)
│   ├── block-ai-wrapper/        @unblocks/block-ai-wrapper
│   ├── block-data-platform/     @unblocks/block-data-platform
│   ├── block-marketplace/       @unblocks/block-marketplace
│   ├── pro-admin/               @unblocks/pro-admin (advanced admin features)
│   ├── pro-connectors/          @unblocks/pro-connectors (HubSpot, Salesforce, etc.)
│   └── pro-templates/           @unblocks/pro-templates (premium landing/email/themes)
├── registry/              (private npm registry config)
├── tests/                 (integration tests across core + blocks)
└── package.json           (pnpm workspace)
```

**Key principle:** This public repo MUST work perfectly with zero premium packages installed. All block imports must be optional. If a premium package isn't installed, routes return "block not available" — never a build error.

## Current Coupling Problems

| # | Problem | Location | Fix |
|---|---------|----------|-----|
| 1 | App routes hard-import blocks | `app/api/ai/`, `app/api/data/`, `app/api/marketplace/` | Use block registry with `tryResolveBlock()` |
| 2 | Config files import block types | `config/ai.config.ts`, `config/data.config.ts`, `config/marketplace.config.ts` | Move to optional block config; blocks self-register |
| 3 | Block schemas imported directly | `blocks/ai-wrapper/schema.ts` imports `core/db/schema/users` | Fine — blocks depend on core. But drizzle config needs dynamic schema discovery |
| 4 | Drizzle config static schema path | `drizzle.config.ts` only reads `core/db/schema/` | Glob for installed block schemas too |
| 5 | Dashboard pages import block components | `app/(dashboard)/marketplace/`, etc. | Gate pages behind block availability check |
| 6 | No `@unblocks/blocks` tsconfig alias | Blocks imported via `@/blocks/` | Won't need it — premium blocks become npm packages (`@unblocks/block-ai-wrapper`) |

## What Changes in THIS Repo

### 1. Block Registry (`core/runtime/blockRegistry.ts`) — NEW

A registry where blocks self-register. The public repo ships the registry; premium packages call `registerBlock()` at import time.

```typescript
// core/runtime/blockRegistry.ts
interface BlockRegistration {
  id: string
  name: string
  version: string
  exports: Record<string, unknown>
}

const registry = new Map<string, BlockRegistration>()

export function registerBlock(block: BlockRegistration): void { ... }
export function getBlock(id: string): BlockRegistration | undefined { ... }
export function isBlockAvailable(id: string): boolean { ... }
export function requireBlock<T>(id: string): T { ... }  // throws if not installed
export function tryRequireBlock<T>(id: string): T | null { ... }  // returns null if missing
```

### 2. Update App Routes — Use `tryRequireBlock()`

**Before:**
```typescript
import { complete } from '@/blocks/ai-wrapper'
```

**After:**
```typescript
import { tryRequireBlock } from '@unblocks/core/runtime/blockRegistry'

export const POST = withErrorHandler(async (request: Request) => {
  const ai = tryRequireBlock<typeof import('@unblocks/block-ai-wrapper')>('ai-wrapper')
  if (!ai) {
    return errorResponse('BLOCK_NOT_AVAILABLE', 'AI wrapper block is not installed', 404)
  }
  const result = await ai.complete(body)
  return successResponse(result)
})
```

### 3. Move Premium Block Source Code to `proprietary/`

Move (not delete) from `blocks/` to `proprietary/` staging directory:
- `blocks/ai-wrapper/` → `proprietary/block-ai-wrapper/`
- `blocks/data-platform/` → `proprietary/block-data-platform/`
- `blocks/marketplace/` → `proprietary/block-marketplace/`

Keep in `blocks/`:
- `blocks/testing/` — dev tooling, MIT
- `blocks/seed/` — dev tooling, MIT

The `proprietary/` directory is the staging area. When the private `Unblocks-pro` repo is set up, its contents move to `packages/` there. Add `proprietary/` to `.gitignore` for the public distribution (but track it on this branch for now so nothing is lost).

### 4. Remove Premium Config Files

Delete:
- `config/ai.config.ts` — moves to `block-ai-wrapper` package
- `config/data.config.ts` — moves to `block-data-platform` package
- `config/marketplace.config.ts` — moves to `block-marketplace` package

Each premium package ships its own config file that users place in `config/` when they install.

### 5. Update Drizzle Config — Dynamic Schema Discovery

```typescript
// drizzle.config.ts
import { globSync } from 'glob'

const schemaPaths = [
  './core/db/schema/index.ts',
  ...globSync('./node_modules/@unblocks/block-*/schema.ts'),
]

export default defineConfig({
  schema: schemaPaths,
  ...
})
```

### 6. License Validator (`core/runtime/licenseValidator.ts`) — NEW

Validates `UNBLOCKS_LICENSE_KEY` to determine tier and available features.

```typescript
export interface LicenseInfo {
  valid: boolean
  tier: 'community' | 'builder' | 'pro' | 'team' | 'enterprise'
  features: string[]
  expiresAt: Date | null
}

export function validateLicense(key?: string): LicenseInfo { ... }
export function hasFeature(feature: string): boolean { ... }
```

Used for:
- Attribution removal (`builder` tier, $9/mo)
- Premium core features like advanced admin dashboards, SSE, S3 (`pro` tier)
- Not used for blocks — blocks are gated by package installation

### 7. Feature Flags for Premium Core Features

Some premium features live inside `core/` but are gated:

```typescript
// core/uploads/storage.ts
import { hasFeature } from '../runtime/licenseValidator'

export function getStorageProvider(): StorageProvider {
  if (provider === 's3' && !hasFeature('uploads.s3')) {
    throw new PlanLimitError('S3 uploads require a Pro license')
  }
  ...
}
```

### 8. Dashboard Page Guards

Block dashboard pages check availability before rendering:

```typescript
// app/(dashboard)/ai/page.tsx
import { isBlockAvailable } from '@unblocks/core/runtime/blockRegistry'
import { redirect } from 'next/navigation'

export default async function AIPage() {
  if (!isBlockAvailable('ai-wrapper')) {
    redirect('/dashboard?block=ai-wrapper&status=not-installed')
  }
  ...
}
```

### 9. Update `tsconfig.json`

No `@unblocks/blocks` alias needed — premium blocks are resolved via `node_modules/@unblocks/block-*` in the monorepo workspace. But we do need to make sure the alias structure supports both standalone and monorepo usage:

```json
{
  "paths": {
    "@unblocks/core/*": ["./core/*"],
    "@/*": ["./*"]
  }
}
```

Premium block packages set their own `"main"` and `"types"` in their `package.json`.

### 10. Update `unblocks.manifest.json`

```json
{
  "blocks": {
    "testing": { "tier": "community", "included": true },
    "seed": { "tier": "community", "included": true },
    "ai-wrapper": { "tier": "pro", "included": false, "package": "@unblocks/block-ai-wrapper" },
    "data-platform": { "tier": "pro", "included": false, "package": "@unblocks/block-data-platform" },
    "marketplace": { "tier": "pro", "included": false, "package": "@unblocks/block-marketplace" }
  }
}
```

## Implementation Steps (for THIS repo)

1. **Create `core/runtime/blockRegistry.ts`** — register/resolve/check block availability
2. **Create `core/runtime/licenseValidator.ts`** — license key validation + feature checks
3. **Update 9 app/api routes** that import blocks → use `tryRequireBlock()`
4. **Update 3 dashboard pages** that use blocks → add availability guards
5. **Update 3 config files** → remove block-type imports (or delete configs entirely)
6. **Update `drizzle.config.ts`** → dynamic schema glob
7. **Update `unblocks.manifest.json`** → block tier metadata
8. **Move `blocks/ai-wrapper/`, `blocks/data-platform/`, `blocks/marketplace/`** to `proprietary/`
9. **Update path aliases** in `tsconfig.json` and `vitest.config.ts`
10. **Update docs** — `CLAUDE.md`, `README.md` to document open-core model
11. **Commit and push**

## What the Private Repo Does (not implemented here)

The `Unblocks-pro` monorepo:
- Receives premium block source code (moved from this repo)
- Each block becomes an npm package (`@unblocks/block-ai-wrapper`, etc.)
- Each block's entry point calls `registerBlock()` from core
- CI publishes to private npm registry
- License validation API runs as a separate service
- Starter kits are pre-configured workspaces with core + selected blocks

## Tier Summary

| Tier | Price | What's Included |
|------|-------|----------------|
| **Community** | Free | Core (auth, billing, email, teams, jobs, local uploads, basic notifications, basic admin), testing/seed blocks, 3 landing templates |
| **Builder** | $9/mo | Community + attribution removal |
| **Pro** | $19/mo | Builder + premium blocks (AI, Data, Marketplace) + advanced admin + SSE + S3 + 20 templates + 10 themes + pro connectors |
| **Team** | $49/mo | Pro + 10 seats + private Discord + early access + priority requests |
| **Enterprise** | Custom | Team + SSO + audit logging + compliance + SAP/Oracle/LDAP + SLA |
| **Starter Kits** | $199 each | Pre-configured project with core + selected blocks |
