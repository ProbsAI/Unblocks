# Seed Block

Generates realistic sample data for local development. Populates users, teams, notifications, jobs, and files.

## Usage

```bash
npm run db:seed
```

## Configuration

Pass options to `seed()` or edit `scripts/db-seed.ts`:

```typescript
import { seed } from '@unblocks/blocks/seed'

await seed({
  userCount: 20,       // Regular users
  adminCount: 2,       // Admin users
  teamCount: 5,        // Teams
  maxMembersPerTeam: 8,
  notificationsPerUser: 10,
  jobCount: 30,
  fileCount: 15,
  defaultPassword: 'password123',
  clearFirst: true,    // Truncate before seeding
})
```

## What Gets Created

| Entity | Default Count | Notes |
|--------|:---:|-------|
| Users | 20 | Realistic names, verified emails |
| Admins | 2 | Same as users but `isAdmin: true` |
| Teams | 5 | With owner + random members |
| Notifications | 10/user | Mix of read/unread, various types |
| Jobs | 30 | Various statuses and priorities |
| Files | 15 | Various types (images, PDFs, CSVs) |

## Generators

You can use generators independently for custom seed scripts:

```typescript
import { generateEmail, generateUserName, generateTeamName } from '@unblocks/blocks/seed'

generateEmail(0)     // 'alice.smith0@example.com'
generateUserName(0)  // 'Alice Smith'
generateTeamName(0)  // 'Engineering'
```
