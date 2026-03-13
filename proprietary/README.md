# proprietary/

This folder contains **proprietary Unblocks content** that is NOT included in the public open-source repository.

When creating fresh public repos from this template, exclude this entire directory.

## What's here

### Premium Blocks

Premium blocks have been moved from `blocks/` to `proprietary/block-*/` so they can be distributed separately as private npm packages:

- `block-ai-wrapper/` — OpenAI/Anthropic completion with usage tracking and cost estimation
- `block-data-platform/` — Pipelines, data sources, and datasets with background job integration
- `block-marketplace/` — Listings, orders, reviews, and seller profiles

## How it integrates

### License Validation

License validation lives in `core/runtime/licenseValidator.ts` (MIT-licensed, in core). It uses `hasFeature()` to gate premium features like attribution removal. The `proprietary/` blocks are detected by the block registry (`core/runtime/blockRegistry.ts`) based on package installation.

### Attribution

Pages check `hasFeature('attribution.remove')` before honoring the `showUnblocksAttribution: false` config setting. Without a valid Builder+ license key, attribution always displays.

## For the public repo

Add to `.gitignore`:
```
proprietary/
```
