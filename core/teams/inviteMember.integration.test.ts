import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  getTestDb,
  truncateAll,
  closeTestDb,
  testDatabaseUrl,
} from '@unblocks/blocks/testing/integration'

/**
 * Redeeming a team invitation, against a real Postgres.
 *
 * This replaces a mocked suite that stubbed the query builder. That suite
 * asserted the calls the code made, which is why it could not see the defect
 * here: acceptInvitation read the row, checked `accepted_at IS NULL`, added the
 * member, and only then marked it accepted. Two *different* people redeeming
 * the same link both read a null flag, both passed, and both joined the team.
 * The "already a member" check does not help — they are different users.
 *
 * An invitation is for one person, so `accepted_at` has to be what decides,
 * set under the row lock. Only a real database can demonstrate that.
 */

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(async () => undefined),
}))

beforeAll(() => {
  process.env.DATABASE_URL = testDatabaseUrl()
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  process.env.BLIND_INDEX_KEY = 'b'.repeat(64)
})

afterAll(async () => {
  await closeTestDb()
})

let ownerId = ''
let inviteeId = ''
let otherId = ''
let teamId = ''

async function createUser(email: string): Promise<string> {
  const db = getTestDb()
  const [row] = (
    await db.execute(sql`
      INSERT INTO users (email, name, email_verified)
      VALUES (${email}, ${email}, true)
      RETURNING id
    `)
  ).rows as Array<{ id: string }>
  return row.id
}

beforeEach(async () => {
  await truncateAll()
  vi.clearAllMocks()

  ownerId = await createUser('owner@example.com')
  inviteeId = await createUser('invitee@example.com')
  otherId = await createUser('other@example.com')

  const db = getTestDb()
  const [team] = (
    await db.execute(sql`
      INSERT INTO teams (name, slug, owner_id)
      VALUES ('Team', 'team', ${ownerId})
      RETURNING id
    `)
  ).rows as Array<{ id: string }>
  teamId = team.id

  await db.execute(sql`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (${teamId}, ${ownerId}, 'owner')
  `)
})

async function invite(email = 'invitee@example.com'): Promise<string> {
  const { inviteMember } = await import('./inviteMember')
  const { token } = await inviteMember(teamId, email, 'member', ownerId)
  return token
}

async function memberCount(): Promise<number> {
  const db = getTestDb()
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM team_members WHERE team_id = ${teamId}
  `)
  return (result.rows as Array<{ n: number }>)[0].n
}

describe('acceptInvitation', () => {
  it('adds the member and marks the invitation accepted', async () => {
    const { acceptInvitation } = await import('./inviteMember')

    await acceptInvitation(await invite(), inviteeId)

    expect(await memberCount()).toBe(2)
  })

  it('lets only one of two different people redeem the same link', async () => {
    const { acceptInvitation } = await import('./inviteMember')
    const token = await invite()

    // The link is shareable — forwarded email, copied URL. Two different
    // accounts redeeming it at once is the case the flag has to settle.
    const results = await Promise.allSettled([
      acceptInvitation(token, inviteeId),
      acceptInvitation(token, otherId),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    // Owner plus exactly one invitee.
    expect(await memberCount()).toBe(2)
  })

  it('refuses a second redemption after the first', async () => {
    const { acceptInvitation } = await import('./inviteMember')
    const token = await invite()

    await acceptInvitation(token, inviteeId)

    await expect(acceptInvitation(token, otherId)).rejects.toThrow(
      /already been accepted/i
    )
    expect(await memberCount()).toBe(2)
  })

  it('reports an unknown token as not found', async () => {
    const { acceptInvitation } = await import('./inviteMember')

    await expect(
      acceptInvitation('f'.repeat(64), inviteeId)
    ).rejects.toThrow(/not found/i)
  })

  it('reports an expired invitation as expired, not as missing', async () => {
    // Losing the claim is ambiguous — unknown, used, or expired all look the
    // same to the UPDATE. The read-back on the failure path exists so the
    // caller still gets an accurate reason.
    const { acceptInvitation } = await import('./inviteMember')
    const token = await invite()

    const db = getTestDb()
    await db.execute(sql`
      UPDATE team_invitations SET expires_at = NOW() - INTERVAL '1 hour'
    `)

    await expect(acceptInvitation(token, inviteeId)).rejects.toThrow(
      /expired/i
    )
    expect(await memberCount()).toBe(1)
  })

  it('refuses when the user is already in the team', async () => {
    const { acceptInvitation } = await import('./inviteMember')

    await expect(
      acceptInvitation(await invite('owner@example.com'), ownerId)
    ).rejects.toThrow(/already a member/i)
  })
})

describe('inviteMember', () => {
  it('returns a plaintext token that is not what is stored', async () => {
    const { acceptInvitation } = await import('./inviteMember')
    const token = await invite()

    const db = getTestDb()
    const result = await db.execute(sql`
      SELECT token, token_hash FROM team_invitations LIMIT 1
    `)
    const row = (result.rows as Array<{ token: string; token_hash: string }>)[0]

    // Stored one-way. A digest in the column is the point; it must not equal
    // the secret the caller was handed.
    expect(row.token).not.toBe(token)
    expect(row.token_hash).not.toBe(token)

    // And the plaintext still works, which is what makes the link usable.
    await acceptInvitation(token, inviteeId)
    expect(await memberCount()).toBe(2)
  })
})
