# UI Overrides

Place your custom UI components here to override the defaults.

## Directory Structure

```
ui/
  theme.ts           # Default theme tokens (edit globals.css to override)
  components/        # Override any component from components/
  layouts/           # Override any layout from app/
  pages/             # Override any page from app/
  email-templates/   # Override email templates
```

## How It Works

The UI override system is planned for V1B. In V1A, customize by:

1. **Theme**: Edit `app/globals.css` `@theme` block to change colors, fonts, radii
2. **Components**: Edit files directly in `components/`
3. **Layouts**: Edit route group layouts in `app/(auth)/layout.tsx`, `app/(dashboard)/layout.tsx`
4. **Landing page**: Edit `config/app.config.ts` to change hero text, features, FAQ

In V1B, files placed in `ui/components/` will automatically shadow their counterparts in `components/`, allowing non-destructive customization.
