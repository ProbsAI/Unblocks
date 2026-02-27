# Extensions

Place your custom extensions here to add functionality to Unblocks.

## Extension System (V1B)

The extension system is planned for V1B. Extensions will be self-contained modules that add features to your app without modifying core code.

## Planned Extension Structure

```
extensions/
  my-extension/
    manifest.json     # Extension metadata, dependencies, hooks
    index.ts          # Entry point
    schema.ts         # Database schema additions (if any)
    routes/           # API routes
    components/       # UI components
    config.ts         # Extension config
```

## V1A: Manual Extension

In V1A, extend the platform by:

1. **Adding database tables** in `core/db/schema/`
2. **Adding API routes** in `app/api/`
3. **Using hooks** in `hooks/` to react to events
4. **Editing config** in `config/` to adjust behavior
