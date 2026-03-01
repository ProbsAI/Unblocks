# Hooks

Hooks let you react to events and modify behavior without changing core code.

## Available Hooks

### Lifecycle Hooks

| Hook | When it fires | Args |
|------|--------------|------|
| `onUserCreated` | After a new user registers | `{ user, method }` |
| `onUserDeleted` | After a user is deleted | `{ user }` |
| `onAuthSuccess` | After successful login | `{ user, method, ip }` |
| `onAuthFailure` | After failed login attempt | `{ email, reason, ip }` |

### Billing Hooks

| Hook | When it fires | Args |
|------|--------------|------|
| `onPaymentSucceeded` | After Stripe payment succeeds | `{ userId, amount, plan, invoiceUrl }` |
| `onPaymentFailed` | After Stripe payment fails | `{ userId, amount, error }` |
| `onSubscriptionChanged` | After plan change/cancel | `{ userId, oldPlan, newPlan, subscription }` |

### Modifier Hooks

| Hook | When it fires | Args |
|------|--------------|------|
| `beforeEmailSend` | Before any email is sent | `{ to, subject, html }` — return modified args |

### System Hooks

| Hook | When it fires | Args |
|------|--------------|------|
| `onError` | When any other hook throws | `{ error, hookName, args }` |

## How to Create a Hook

1. Create a file in `hooks/` named after the event (e.g., `hooks/onUserCreated.ts`)
2. Export a default async function:

```typescript
// hooks/onUserCreated.ts
import type { OnUserCreatedArgs } from '@unblocks/core/auth/types'

export default async function onUserCreated(args: OnUserCreatedArgs) {
  console.log(`New user: ${args.user.email}`)
  // Send welcome email, create Stripe customer, log analytics, etc.
}
```

## Rules

- Hook errors are caught and logged — they never crash the app
- Hooks are awaited — they run before the response is sent
- `beforeEmailSend` can modify the email args by returning a new object
- Multiple hooks for the same event are supported (they run in sequence)
