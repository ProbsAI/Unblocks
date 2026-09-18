# Unblocks Private Repository — Setup & Configuration Plan

> This document is a complete handoff for a Claude Code instance with access to the `unblocks-private` repo.
> It contains everything needed to set up the private repo, move proprietary blocks, and establish safeguards.

## Overview

The public `Unblocks` repo (MIT) contains all core features including AI, API keys, auth, billing, teams, jobs, uploads, notifications, and admin. Premium blocks (data-platform, marketplace) and enterprise features (SSO, audit logging, compliance) live in a separate private repository.

## Repository Structure

```
unblocks-private/
├── public/                    # git submodule → github.com/probsai/unblocks
├── private/
│   ├── blocks/
│   │   ├── data-platform/     # @unblocks/block-data-platform
│   │   │   ├── types.ts       # Pipeline, DataSource, Dataset types
│   │   │   ├── pipelines.ts   # CRUD & execution for pipelines
│   │   │   ├── datasources.ts # Data source management
│   │   │   ├── datasets.ts    # Dataset management
│   │   │   ├── schema.ts      # Drizzle tables: pipelines, dataSources, datasets, pipelineRuns
│   │   │   ├── index.ts       # Barrel export + registerBlock() call
│   │   │   ├── package.json   # npm package definition
│   │   │   └── tsconfig.json  # TypeScript config
│   │   └── marketplace/       # @unblocks/block-marketplace
│   │       ├── types.ts       # Listing, Order, Review, SellerProfile types
│   │       ├── listings.ts    # Listings CRUD + search
│   │       ├── orders.ts      # Order creation + status flow
│   │       ├── reviews.ts     # Review creation + aggregation
│   │       ├── seller.ts      # Seller profile management
│   │       ├── schema.ts      # Drizzle tables: listings, orders, reviews, sellerProfiles
│   │       ├── index.ts       # Barrel export + registerBlock() call
│   │       ├── package.json   # npm package definition
│   │       └── tsconfig.json  # TypeScript config
│   └── enterprise/            # Future enterprise modules
│       ├── sso/               # SAML/SCIM integration
│       ├── audit/             # Audit logging
│       └── compliance/        # GDPR, HIPAA automation
├── scripts/
│   ├── build-blocks.sh        # Build + publish blocks to private npm
│   ├── sync-public.sh         # Pull latest from public submodule
│   └── safeguard-check.sh     # Pre-commit hook: prevent private→public leaks
├── .gitmodules                # Points public/ to public repo
├── .npmrc                     # Private registry config
├── package.json               # Monorepo root (workspaces)
├── tsconfig.json              # Root TypeScript config
└── README.md                  # Private repo documentation
```

## Step 1: Git Submodule Setup

```bash
cd unblocks-private

# Add the public repo as a submodule
git submodule add https://github.com/probsai/unblocks.git public
git submodule update --init --recursive

# Verify
ls public/core/  # Should show auth/, billing/, ai/, api-keys/, etc.
```

### .gitmodules
```
[submodule "public"]
    path = public
    url = https://github.com/probsai/unblocks.git
    branch = main
```

## Step 2: Safeguards (CRITICAL)

### scripts/safeguard-check.sh
```bash
#!/bin/bash
set -e

# 1. Ensure no files inside public/ are staged for commit
STAGED_PUBLIC=$(git diff --cached --name-only | grep "^public/" || true)
if [ -n "$STAGED_PUBLIC" ]; then
  echo "ERROR: Cannot commit changes to public/ submodule directly."
  echo "Submit changes to the public repo via PR instead."
  echo "Staged public files:"
  echo "$STAGED_PUBLIC"
  exit 1
fi

# 2. Ensure no private imports leak into public/
# (Check if any file references private block packages)
if grep -r "@unblocks/block-" public/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v ".git"; then
  echo "ERROR: Found private block imports in public/ directory."
  exit 1
fi

# 3. Ensure no private/ paths are referenced in public/
if grep -r "private/" public/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v ".git"; then
  echo "ERROR: Found references to private/ in public/ directory."
  exit 1
fi

echo "Safeguard check passed."
```

### Install as git hook
```bash
chmod +x scripts/safeguard-check.sh

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
bash scripts/safeguard-check.sh
HOOK
chmod +x .git/hooks/pre-commit
```

## Step 3: Block Package Setup

### Each block needs a package.json

#### private/blocks/data-platform/package.json
```json
{
  "name": "@unblocks/block-data-platform",
  "version": "0.2.0",
  "description": "Unblocks Data Platform — Pipelines, data sources, and datasets",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "drizzle-orm": "^0.38.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/probsai/unblocks-private.git",
    "directory": "private/blocks/data-platform"
  }
}
```

#### private/blocks/marketplace/package.json
```json
{
  "name": "@unblocks/block-marketplace",
  "version": "0.2.0",
  "description": "Unblocks Marketplace — Listings, orders, reviews, and seller profiles",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "drizzle-orm": "^0.38.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/probsai/unblocks-private.git",
    "directory": "private/blocks/marketplace"
  }
}
```

### Block Registration Pattern

Each block's `index.ts` MUST call `registerBlock()` from the public core:

```typescript
// private/blocks/data-platform/index.ts
import { registerBlock } from '@unblocks/core/runtime/blockRegistry'
import { createPipeline, getPipeline, listPipelines, triggerPipelineRun, getPipelineRuns, updatePipelineStatus } from './pipelines'
import { createDataSource, listDataSources, deleteDataSource } from './datasources'
import { createDataset, listDatasets, getDataset, deleteDataset } from './datasets'
import { pipelines, dataSources, datasets, pipelineRuns } from './schema'

registerBlock({
  id: 'data-platform',
  name: 'Data Platform',
  version: '0.2.0',
  exports: {
    createPipeline, getPipeline, listPipelines,
    triggerPipelineRun, getPipelineRuns, updatePipelineStatus,
    createDataSource, listDataSources, deleteDataSource,
    createDataset, listDatasets, getDataset, deleteDataset,
  },
  schemas: { pipelines, dataSources, datasets, pipelineRuns },
})

export {
  createPipeline, getPipeline, listPipelines,
  triggerPipelineRun, getPipelineRuns, updatePipelineStatus,
  createDataSource, listDataSources, deleteDataSource,
  createDataset, listDatasets, getDataset, deleteDataset,
}
```

```typescript
// private/blocks/marketplace/index.ts
import { registerBlock } from '@unblocks/core/runtime/blockRegistry'
import { createListing, getListing, searchListings, getSellerListings, updateListingStatus } from './listings'
import { createOrder, getOrder, getUserOrders, updateOrderStatus } from './orders'
import { createReview, getListingReviews, getSellerReviews } from './reviews'
import { createSellerProfile, getSellerProfile, updateSellerProfile } from './seller'
import { listings, orders, reviews, sellerProfiles } from './schema'

registerBlock({
  id: 'marketplace',
  name: 'Marketplace',
  version: '0.2.0',
  exports: {
    createListing, getListing, searchListings, getSellerListings, updateListingStatus,
    createOrder, getOrder, getUserOrders, updateOrderStatus,
    createReview, getListingReviews, getSellerReviews,
    createSellerProfile, getSellerProfile, updateSellerProfile,
  },
  schemas: { listings, orders, reviews, sellerProfiles },
})

export {
  createListing, getListing, searchListings, getSellerListings, updateListingStatus,
  createOrder, getOrder, getUserOrders, updateOrderStatus,
  createReview, getListingReviews, getSellerReviews,
  createSellerProfile, getSellerProfile, updateSellerProfile,
}
```

## Step 4: Private NPM Registry Setup

### Option A: GitHub Packages (Recommended)

```bash
# .npmrc at repo root
@unblocks:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Publish blocks
```bash
cd private/blocks/data-platform && npm publish
cd private/blocks/marketplace && npm publish
```

### Option B: Verdaccio (Self-hosted)
```bash
# Run Verdaccio locally or on a server
npx verdaccio

# .npmrc
@unblocks:registry=http://localhost:4873
```

## Step 5: Build Script

### scripts/build-blocks.sh
```bash
#!/bin/bash
set -e

echo "Building blocks..."

for block in private/blocks/*/; do
  name=$(basename "$block")
  echo "  Building $name..."
  cd "$block"
  npm run build
  cd -
done

echo "All blocks built successfully."
```

### scripts/sync-public.sh
```bash
#!/bin/bash
set -e

echo "Syncing public submodule..."
git submodule update --remote public
echo "Public repo updated to: $(cd public && git rev-parse --short HEAD)"
```

## Step 6: Testing

### Test setup for private blocks

Private blocks should import test helpers from the public repo via the submodule:

```typescript
// In private block test files
import { createTestUser, createTestTeam } from '../../public/blocks/testing'
```

### Add tests for each block (currently zero coverage)

For data-platform:
- `pipelines.test.ts` — CRUD, trigger run, status updates
- `datasources.test.ts` — CRUD operations
- `datasets.test.ts` — CRUD operations

For marketplace:
- `listings.test.ts` — CRUD, search, filtering
- `orders.test.ts` — Create, status flow
- `reviews.test.ts` — Create, aggregation
- `seller.test.ts` — Profile CRUD

## Step 7: Development Workflow

### Making changes to the public repo
1. Work in a separate clone of `probsai/unblocks`
2. Create PR, review, merge to main
3. In unblocks-private: `bash scripts/sync-public.sh`

### Making changes to private blocks
1. Edit files in `private/blocks/<block>/`
2. Run tests: `npm run test` in block directory
3. Build: `bash scripts/build-blocks.sh`
4. Publish: `npm publish` in block directory
5. Commit to unblocks-private

### NEVER do
- Modify files inside `public/` directly — always go through the public repo
- Import from `private/` in any public repo file
- Commit private block code to the public repo
- Push the public submodule pointer without first verifying the public commit is on main

## Step 8: Root package.json

```json
{
  "name": "unblocks-private",
  "private": true,
  "workspaces": [
    "private/blocks/*"
  ],
  "scripts": {
    "build": "bash scripts/build-blocks.sh",
    "sync": "bash scripts/sync-public.sh",
    "test": "vitest run",
    "safeguard": "bash scripts/safeguard-check.sh"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

## Step 9: CI/CD for Private Repo

### .github/workflows/ci.yml
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://npm.pkg.github.com
      - run: npm install
      - run: bash scripts/safeguard-check.sh
      - run: npm run build
      - run: npm run test
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Step 10: Moving Existing Block Code

The owner has the following block source files to move into this structure:
- `block-ai-wrapper/` — Already moved to public core (no action needed)
- `block-data-platform/` — Move to `private/blocks/data-platform/`
- `block-marketplace/` — Move to `private/blocks/marketplace/`

For each block:
1. Copy the source files (types.ts, main modules, schema.ts)
2. Fix import paths (change `../../core/` to use `@unblocks/core/` path aliases)
3. Add `index.ts` with `registerBlock()` call (pattern shown above)
4. Add `package.json` (templates shown above)
5. Add `tsconfig.json` extending root config
6. Write tests (currently zero coverage on both blocks)
7. Build and publish to private npm registry

## Key Integration Points

### How blocks connect to the public core

The public repo's `core/runtime/blockRegistry.ts` provides:
- `registerBlock(registration)` — blocks call this at import time
- `tryRequireBlock<T>(id)` — routes use this for graceful degradation
- `requireBlock<T>(id)` — routes use this when block is required
- `isBlockAvailable(id)` — pages check this before rendering
- `getBlockSchemas()` — drizzle config discovers block tables

### API routes in public repo

The public repo has API route stubs for these blocks:
- `app/api/data/pipelines/route.ts` — calls `tryRequireBlock('data-platform')`
- `app/api/data/datasets/route.ts` — calls `tryRequireBlock('data-platform')`
- `app/api/marketplace/listings/route.ts` — calls `tryRequireBlock('marketplace')`
- `app/api/marketplace/orders/route.ts` — calls `tryRequireBlock('marketplace')`
- `app/api/marketplace/reviews/route.ts` — calls `tryRequireBlock('marketplace')`

These routes gracefully return 404 with `BLOCK_NOT_AVAILABLE` when the blocks aren't installed.

### Dashboard pages in public repo

- `app/(dashboard)/data/page.tsx` — checks `isBlockAvailable('data-platform')`
- `app/(dashboard)/marketplace/page.tsx` — checks `isBlockAvailable('marketplace')`

These redirect to `/dashboard?block=<id>&status=not-installed` when blocks aren't available.

## License Tiers (Updated)

The public repo's tier system has been updated:
- **Community (free):** All core features including AI, API keys, S3, SSE, admin
- **Pro ($29/mo):** data-platform block, marketplace block, advanced analytics, premium templates
- **Business ($299/mo):** Pro + white-labeling, audit logging, metered billing
- **Enterprise (custom):** Business + SSO/SAML/SCIM, multi-tenancy, compliance, SLA

License key prefixes: `ub_pro_`, `ub_biz_`, `ub_ent_`
