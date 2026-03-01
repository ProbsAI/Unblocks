# Plan: Separate Premium/Proprietary Features from MIT-Licensed Code

## Current State Analysis

**Everything is MIT-licensed.** The entire codebase — `core/`, `blocks/`, `app/`, `config/`, `components/` — sits under a single MIT LICENSE file. There are no license gates, no feature checks, and no separation between "community" and "premium" tiers.

### What Should Be Premium (Candidates)

Based on typical open-core SaaS models and what's currently in the codebase:

| Feature | Location | Why Premium |
|---------|----------|-------------|
| **AI wrapper block** | `blocks/ai-wrapper/` | Value-add vertical — AI completion, usage tracking, prompt templates |
| **Data platform block** | `blocks/data-platform/` | Value-add vertical — pipelines, datasources, datasets |
| **Marketplace block** | `blocks/marketplace/` | Value-add vertical — listings, orders, reviews, seller profiles |
| **Admin panel** | `core/admin/` | Advanced ops — user management, metrics, subscription admin |
| **SSE notifications** | `core/notifications/` streaming | Real-time push is a premium UX feature |
| **S3 uploads** | `core/uploads/` S3 provider | Cloud storage integration |
| **Attribution removal** | Footer `showAttribution` | License key to remove "Built with Unblocks" |

### What Stays MIT (Community)

Auth, billing/Stripe, email, teams, jobs, local uploads, basic notifications, config system, hooks, DB schema, landing page, security utilities, testing/seed blocks (dev tooling).

## Coupling Problems

1. **Blocks import core DB directly**: `blocks/ai-wrapper/schema.ts` does `import { users } from '../../core/db/schema/users'` — relative path into core
2. **App routes import blocks directly**: `app/api/ai/completion/route.ts` does `import { complete } from '@/blocks/ai-wrapper'` — hard coupling
3. **Block schemas not in drizzle config**: `drizzle.config.ts` only points at `./core/db/schema/index.ts`, but block schemas exist separately
4. **No `@unblocks/blocks` path alias in tsconfig**: blocks are imported via `@/blocks/` (root-relative), not a dedicated alias
5. **Config files import block types**: `config/ai.config.ts` imports from `@unblocks/blocks/ai-wrapper/types`
6. **No runtime feature gating**: No mechanism to check if a block is licensed/enabled before serving its routes

## Proposed Architecture

### Directory Structure

```
core/                    # MIT — stays as-is
blocks/
  testing/               # MIT — dev tooling stays open
  seed/                  # MIT — dev tooling stays open
proprietary/             # NEW — Business Source License (BSL) or similar
  LICENSE                # BSL/proprietary license file
  blocks/
    ai-wrapper/          # Moved from blocks/ai-wrapper/
    data-platform/       # Moved from blocks/data-platform/
    marketplace/         # Moved from blocks/marketplace/
  interfaces/            # NEW — thin interface contracts (types + no-op stubs)
    ai-wrapper.ts        # Re-exports types + stub functions
    data-platform.ts     # Re-exports types + stub functions
    marketplace.ts       # Re-exports types + stub functions
  admin/                 # Moved from core/admin/ (if admin is premium)
```

### Interface Layer (the "thin interface")

Each premium feature gets an interface file that:
- Exports the **types** (so MIT code can reference them without importing proprietary code)
- Exports **stub/no-op implementations** that return empty results or throw "feature not available"
- Gets swapped at runtime when the proprietary module is present

```typescript
// proprietary/interfaces/ai-wrapper.ts
import type { CompletionRequest, CompletionResponse } from '../blocks/ai-wrapper/types'

export type { CompletionRequest, CompletionResponse }

// Default stubs — overridden when proprietary/ is installed
export async function complete(req: CompletionRequest): Promise<CompletionResponse> {
  throw new Error('AI wrapper requires an Unblocks license. See https://unblocks.ai/pricing')
}
```

### Runtime Resolution Pattern

Add a block resolver in `core/runtime/` that:
1. Checks `unblocks.manifest.json` to see which blocks are enabled
2. Checks for `UNBLOCKS_LICENSE_KEY` validity (API call or local signature check)
3. Dynamically imports the real implementation from `proprietary/blocks/` if licensed
4. Falls back to the stub interface if not

```typescript
// core/runtime/blockResolver.ts  (MIT — this stays in core)
export async function resolveBlock<T>(blockId: string, interfacePath: string): Promise<T> {
  const manifest = loadManifest()
  if (!manifest.blocks[blockId]) {
    throw new Error(`Block "${blockId}" is not enabled`)
  }

  // Try to load proprietary implementation
  try {
    const mod = await import(`../../proprietary/blocks/${blockId}`)
    return mod as T
  } catch {
    // Fall back to interface stubs
    const stub = await import(`../../proprietary/interfaces/${blockId}`)
    return stub as T
  }
}
```

### App Route Changes

API routes stop importing blocks directly and use the resolver:

```typescript
// app/api/ai/completion/route.ts — BEFORE
import { complete } from '@/blocks/ai-wrapper'

// app/api/ai/completion/route.ts — AFTER
import { resolveBlock } from '@unblocks/core/runtime/blockResolver'
import type { AIWrapperBlock } from '@/proprietary/interfaces/ai-wrapper'

export const POST = withErrorHandler(async (request: Request) => {
  const ai = await resolveBlock<AIWrapperBlock>('ai-wrapper', 'ai-wrapper')
  const result = await ai.complete(body)
  return successResponse(result)
})
```

### DB Schema Handling

Block schemas need to be conditionally included:

1. Move block table definitions to `proprietary/blocks/*/schema.ts`
2. Update `drizzle.config.ts` to conditionally include proprietary schemas:
   ```typescript
   const schemaPaths = ['./core/db/schema/index.ts']
   if (fs.existsSync('./proprietary/blocks')) {
     schemaPaths.push('./proprietary/blocks/*/schema.ts')
   }
   ```
3. Block schemas continue to reference `core/db/schema/users` — this is fine since core is the dependency direction (proprietary depends on core, never reverse)

### License Validation

```typescript
// core/runtime/licenseValidator.ts (MIT — validation logic is open)
export interface LicenseInfo {
  valid: boolean
  tier: 'community' | 'pro' | 'enterprise'
  features: string[]
  expiresAt: Date | null
}

export async function validateLicense(key: string): Promise<LicenseInfo> {
  if (!key) return { valid: false, tier: 'community', features: [], expiresAt: null }
  // Validate signature locally (public key embedded) or call license API
  // ...
}
```

### .gitignore / Distribution

- `proprietary/` gets its own `LICENSE` file (BSL, commercial, or similar)
- For public GitHub repo: add `proprietary/` to `.gitignore`
- Distribute proprietary code via: private npm package, git submodule, or license-gated download
- The public repo works standalone with stubs — all MIT routes function, premium routes return "not available"

## Implementation Steps

1. **Create `proprietary/` directory structure** with its own LICENSE
2. **Create interface contracts** (`proprietary/interfaces/*.ts`) with types + stubs for each premium block
3. **Build `core/runtime/blockResolver.ts`** — the dynamic import resolver
4. **Build `core/runtime/licenseValidator.ts`** — license key checking
5. **Move `blocks/ai-wrapper/`, `blocks/data-platform/`, `blocks/marketplace/`** to `proprietary/blocks/`
6. **Update all app/api routes** that import blocks to use `resolveBlock()` instead of direct imports
7. **Update config files** (`config/ai.config.ts`, `config/data.config.ts`, `config/marketplace.config.ts`) to import types from interfaces
8. **Update `drizzle.config.ts`** to conditionally include proprietary schemas
9. **Update `tsconfig.json`** to add `@unblocks/proprietary/*` path alias
10. **Wire up `UNBLOCKS_LICENSE_KEY`** in footer attribution + block resolution
11. **Update `unblocks.manifest.json`** to distinguish community vs premium blocks
12. **Update docs** (CLAUDE.md, README) to document the dual-license model
13. **Add `.gitignore` entry** for `proprietary/` in public distribution
