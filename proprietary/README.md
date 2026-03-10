# proprietary/

This folder contains **proprietary Unblocks code** that is NOT included in the public open-source repository.

When creating fresh public repos from this template, exclude this entire directory.

## What's here

### `license/`
- `validate.ts` — License key validation logic
- `types.ts` — License tier definitions and entitlements
- `index.ts` — Barrel exports

## How it integrates

The Footer component checks `canRemoveAttribution()` before honoring the `showUnblocksAttribution: false` config setting. Without a valid license key, attribution always displays.

## For the public repo

Add to `.gitignore`:
```
proprietary/
```
