/**
 * Unblocks Default Theme Tokens
 *
 * These tokens map to the CSS custom properties defined in app/globals.css.
 * Override them by editing your globals.css @theme block or by placing
 * your own theme file at ui/theme.ts.
 *
 * The config system reads these values and the landing page / dashboard
 * components use them via Tailwind utility classes.
 */

export const defaultTheme = {
  colors: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryLight: '#dbeafe',
    secondary: '#7c3aed',
    accent: '#f59e0b',
    background: '#ffffff',
    foreground: '#0f172a',
    muted: '#f1f5f9',
    mutedForeground: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
  },

  fonts: {
    heading: '"Inter", ui-sans-serif, system-ui, sans-serif',
    body: '"Inter", ui-sans-serif, system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },

  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  },
} as const

export type Theme = typeof defaultTheme
