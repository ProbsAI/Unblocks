import { SignJWT, jwtVerify } from 'jose'
import { randomBytes } from 'crypto'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is required')
  return new TextEncoder().encode(secret)
}

export interface TokenPayload {
  userId: string
  sessionId: string
  type: 'session' | 'email_verification' | 'password_reset' | 'magic_link'
}

export async function createToken(
  payload: TokenPayload,
  expiresIn: string = '7d'
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}

export function generateRandomToken(): string {
  return randomBytes(32).toString('hex')
}

/** 32 bytes of hex — exactly what generateRandomToken emits. */
const RANDOM_TOKEN_FORMAT = /^[0-9a-f]{64}$/

/**
 * Does this look like a token this app issued?
 *
 * Check it before deriving a blind index. Every lookup path here is reachable
 * from a public endpoint with an arbitrary string, and blindIndex runs PBKDF2 —
 * so without a bound, an unauthenticated caller can make the server hash
 * megabytes of attacker-controlled input, synchronously, on the event loop.
 *
 * Nothing outside this shape can match a stored row anyway, so rejecting early
 * costs nothing and is the only thing standing between the public routes and
 * that CPU. Lives beside generateRandomToken deliberately: if the generator's
 * shape changes, this has to change with it.
 */
export function isWellFormedToken(token: string): boolean {
  return RANDOM_TOKEN_FORMAT.test(token)
}
